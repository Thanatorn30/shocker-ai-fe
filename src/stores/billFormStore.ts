"use client";

import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import { createBill, deleteBillImage, extractBill, getBill, updateBill, uploadBillImage } from "@/lib/api/bills";
import { ACCEPTED_TYPES, MAX_FILE_MB, MAX_IMAGES } from "./billImageRules";
import type {
  Bill,
  BillDirection,
  BillDocType,
  BillImage,
  BillItemInput,
  BillStatus,
  CreateBillInput,
  PartnerRef,
  UpdateBillInput,
} from "@/types/bill";

// state ฟอร์มสร้าง/แก้ไขบิล — ช่องตัวเลขเก็บเป็น string ตามที่พิมพ์ แล้วแปลงตอนสร้าง payload
// กติกา validate ตรงกับ webchat-be src/lib/validate.ts + src/controllers/bills.ts

export type ItemRow = {
  key: string; // key ฝั่ง client (ไม่ส่งไป BE)
  name: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
};

export type BillFormValues = {
  contactId: string;
  direction: BillDirection | "";
  docType: BillDocType;
  status: BillStatus;
  billNo: string;
  billDate: string; // YYYY-MM-DD
  partnerNameRaw: string;
  partnerTaxIdRaw: string;
  partnerId: string | null;
  subtotal: string;
  discount: string;
  vat: string;
  total: string;
  paidAmount: string;
  currency: string;
  paymentMethod: string;
  note: string;
  extractionIds: string; // สร้างใหม่: id รูปจาก LINE คั่นด้วย , หรือขึ้นบรรทัด (สูงสุด 3)
  rememberAlias: boolean;
  /** สร้างใหม่ + ไม่ได้เลือกคู่ค้า: ชื่อคู่ค้าที่จะสร้าง (ชื่อซ้ำของเดิม = ใช้คู่ค้าเดิม) — "" = ไม่ระบุคู่ค้า */
  newPartnerName: string;
};

export type FieldErrors = Partial<Record<keyof BillFormValues | `items.${number}.${keyof ItemRow}` | "items", string>>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 200;

const emptyValues = (contactId = ""): BillFormValues => ({
  contactId,
  direction: "",
  docType: "other",
  status: "draft",
  billNo: "",
  billDate: "",
  partnerNameRaw: "",
  partnerTaxIdRaw: "",
  partnerId: null,
  subtotal: "",
  discount: "",
  vat: "",
  total: "",
  paidAmount: "0",
  currency: "THB",
  paymentMethod: "",
  note: "",
  extractionIds: "",
  rememberAlias: true,
  newPartnerName: "",
});

let keySeq = 0;
const newKey = () => `row-${Date.now().toString(36)}-${(keySeq++).toString(36)}`;
export const emptyItem = (): ItemRow => ({ key: newKey(), name: "", quantity: "", unit: "", unitPrice: "", amount: "" });

const s = (v: string | null | undefined) => v ?? "";

const itemRowFromBill = (it: Bill["items"][number]): ItemRow => ({
  key: newKey(),
  name: s(it.name),
  quantity: s(it.quantity),
  unit: s(it.unit),
  unitPrice: s(it.unitPrice),
  amount: s(it.amount),
});

function valuesFromBill(b: Bill): BillFormValues {
  return {
    contactId: b.contactId ?? "",
    direction: b.direction,
    docType: b.docType,
    status: b.status,
    billNo: s(b.billNo),
    billDate: b.billDate ? b.billDate.slice(0, 10) : "",
    partnerNameRaw: s(b.partnerNameRaw),
    partnerTaxIdRaw: s(b.partnerTaxIdRaw),
    partnerId: b.partnerId,
    subtotal: s(b.subtotal),
    discount: s(b.discount),
    vat: s(b.vat),
    total: s(b.total),
    paidAmount: s(b.paidAmount) || "0",
    currency: b.currency,
    paymentMethod: s(b.paymentMethod),
    note: s(b.note),
    extractionIds: "",
    rememberAlias: true,
    newPartnerName: "",
  };
}

// ───────────────────────── แปลงค่า + validate ─────────────────────────

/** "1,250.50" → 1250.5, "" → null, ผิดรูปแบบ → NaN */
export function parseNumber(v: string): number | null {
  const t = v.replace(/,/g, "").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

const textOrNull = (v: string) => v.trim() || null;

function validate(v: BillFormValues, items: ItemRow[], mode: "create" | "edit"): FieldErrors {
  const e: FieldErrors = {};
  if (v.contactId && !UUID_RE.test(v.contactId)) e.contactId = "ลูกค้า LINE ไม่ถูกต้อง";
  if (!v.direction) e.direction = "กรุณาเลือกบิลซื้อหรือบิลขาย";

  if (v.billNo.length > 100) e.billNo = "ยาวได้ไม่เกิน 100 ตัวอักษร";
  if (v.billDate) {
    const y = Number(v.billDate.slice(0, 4));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.billDate) || y < 2000 || y > 2100) e.billDate = "วันที่ต้องเป็นปี ค.ศ. (YYYY-MM-DD)";
  }
  if (v.partnerNameRaw.length > 255) e.partnerNameRaw = "ยาวได้ไม่เกิน 255 ตัวอักษร";
  if (v.partnerTaxIdRaw.trim() && v.partnerTaxIdRaw.replace(/\D/g, "").length !== 13) {
    e.partnerTaxIdRaw = "เลขผู้เสียภาษีต้องมี 13 หลัก";
  }

  for (const k of ["subtotal", "discount", "vat", "total"] as const) {
    if (Number.isNaN(parseNumber(v[k]))) e[k] = "ต้องเป็นตัวเลข";
  }
  const paid = parseNumber(v.paidAmount);
  if (Number.isNaN(paid) || (paid !== null && paid < 0)) e.paidAmount = "ต้องเป็นตัวเลขตั้งแต่ 0";
  if (!/^[A-Za-z]{3}$/.test(v.currency.trim())) e.currency = "รหัสสกุลเงิน 3 ตัว เช่น THB";
  if (v.paymentMethod.length > 30) e.paymentMethod = "ยาวได้ไม่เกิน 30 ตัวอักษร";
  if (v.note.length > 2000) e.note = "ยาวได้ไม่เกิน 2000 ตัวอักษร";
  if (v.newPartnerName.trim().length > 255) e.newPartnerName = "ยาวได้ไม่เกิน 255 ตัวอักษร";

  if (mode === "create" && v.extractionIds.trim()) {
    const ids = splitIds(v.extractionIds);
    if (ids.length > 3) e.extractionIds = "แนบรูปได้ไม่เกิน 3 รูป";
    else if (ids.some((id) => !UUID_RE.test(id))) e.extractionIds = "id รูปต้องเป็น uuid";
    else if (new Set(ids).size !== ids.length) e.extractionIds = "มี id รูปซ้ำกัน";
  }

  if (items.length > MAX_ITEMS) e.items = `รายการได้ไม่เกิน ${MAX_ITEMS} แถว`;
  items.forEach((it, i) => {
    if (it.name.length > 255) e[`items.${i}.name`] = "ยาวเกิน 255";
    if (it.unit.length > 30) e[`items.${i}.unit`] = "ยาวเกิน 30";
    for (const k of ["quantity", "unitPrice", "amount"] as const) {
      if (Number.isNaN(parseNumber(it[k]))) e[`items.${i}.${k}`] = "ต้องเป็นตัวเลข";
    }
  });
  return e;
}

const splitIds = (v: string) =>
  v
    .split(/[\s,]+/)
    .map((x) => x.trim())
    .filter(Boolean);

const isBlankItem = (it: ItemRow) => !it.name.trim() && !it.quantity && !it.unit.trim() && !it.unitPrice && !it.amount;

function itemsPayload(items: ItemRow[]): BillItemInput[] {
  return items.filter((it) => !isBlankItem(it)).map((it) => ({
    name: textOrNull(it.name),
    quantity: parseNumber(it.quantity),
    unit: textOrNull(it.unit),
    unitPrice: parseNumber(it.unitPrice),
    amount: parseNumber(it.amount),
  }));
}

/** ช่องที่แก้ได้ทั้งตอนสร้างและแก้ไข — ค่าว่าง = null (BE: ล้างค่า) */
function fieldsPayload(v: BillFormValues) {
  const taxDigits = v.partnerTaxIdRaw.replace(/\D/g, "");
  return {
    direction: v.direction as BillDirection,
    docType: v.docType,
    status: v.status,
    billNo: textOrNull(v.billNo),
    billDate: v.billDate || null,
    partnerNameRaw: textOrNull(v.partnerNameRaw),
    partnerTaxIdRaw: taxDigits || null,
    partnerId: v.partnerId,
    subtotal: parseNumber(v.subtotal),
    discount: parseNumber(v.discount),
    vat: parseNumber(v.vat),
    total: parseNumber(v.total),
    paidAmount: parseNumber(v.paidAmount) ?? 0,
    currency: v.currency.trim().toUpperCase(),
    paymentMethod: textOrNull(v.paymentMethod),
    note: textOrNull(v.note),
  };
}

export function buildCreatePayload(
  v: BillFormValues,
  items: ItemRow[],
  aiData?: Record<string, unknown> | null,
): CreateBillInput {
  const ids = splitIds(v.extractionIds);
  const newPartnerName = v.partnerId ? "" : v.newPartnerName.trim();
  return {
    contactId: v.contactId || null,
    ...fieldsPayload(v),
    items: itemsPayload(items),
    ...(ids.length ? { extractionIds: ids } : {}),
    ...(newPartnerName ? { newPartnerName } : {}),
    ...(aiData ? { aiData } : {}),
  };
}

export function buildUpdatePayload(v: BillFormValues, items: ItemRow[]): UpdateBillInput {
  return { ...fieldsPayload(v), items: itemsPayload(items), rememberAlias: v.rememberAlias };
}

function apiErrorMessage(err: unknown, action: string): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return `ข้อมูลไม่ถูกต้อง: ${err.message}`;
    if (err.status === 403) return "ไม่มีสิทธิ์ทำรายการนี้";
    if (err.status === 404) return "ไม่พบบิลนี้ (อาจถูกลบไปแล้ว)";
    return `${action}ไม่สำเร็จ (${err.status}): ${err.message}`;
  }
  return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";
}

// ───────────────────────── store ─────────────────────────

type State = {
  mode: "create" | "edit";
  billId: string | null;
  values: BillFormValues;
  items: ItemRow[];
  images: BillImage[];
  partner: PartnerRef | null; // คู่ค้าที่เลือก (ไว้แสดงชื่อ)
  /** ผลดิบจาก AI (POST /api/bills/read) — ส่งไปเก็บตอนสร้างบิล */
  aiData: Record<string, unknown> | null;
  errors: FieldErrors;
  loading: boolean;
  loadError: string | null;
  submitting: boolean;
  submitError: string | null;
  savedAt: number | null;
  dirty: boolean;
  uploading: boolean;
  imageError: string | null;
  /** กำลังให้ AI อ่านรูป */
  reading: boolean;
  aiMessage: { tone: "success" | "error" | "info"; text: string } | null;
};

type Actions = {
  startCreate: (contactId?: string) => void;
  /** เริ่มฟอร์มสร้างบิลจากผลที่ AI อ่าน (ขั้นตรวจก่อนบันทึก) */
  startReview: (input: {
    values: Partial<BillFormValues>;
    items: Omit<ItemRow, "key">[];
    partner: PartnerRef | null;
    aiData: Record<string, unknown> | null;
  }) => void;
  load: (id: string) => Promise<void>;
  setField: <K extends keyof BillFormValues>(key: K, value: BillFormValues[K]) => void;
  setPartner: (partner: PartnerRef | null) => void;
  addItem: () => void;
  updateItem: (key: string, patch: Partial<Omit<ItemRow, "key">>) => void;
  removeItem: (key: string) => void;
  moveItem: (key: string, dir: -1 | 1) => void;
  /** จำนวน × ราคาต่อหน่วย → จำนวนเงินของแถว */
  calcItemAmount: (key: string) => void;
  /** รวมจำนวนเงินทุกแถว → ยอดก่อน VAT */
  sumItemsToSubtotal: () => void;
  /** ยอดก่อน VAT − ส่วนลด + VAT → ยอดสุทธิ */
  calcTotal: () => void;
  removeImage: (imageId: string) => Promise<void>;
  /** อัปโหลดรูปเพิ่มเข้าบิลที่บันทึกแล้ว (ทีละรูป, รวมไม่เกิน 3) */
  uploadImages: (files: FileList | File[]) => Promise<void>;
  /** ให้ AI อ่านรูปทั้งหมดของบิล — overwrite = แทนที่ค่าที่กรอกไว้ด้วยค่าที่ AI อ่านได้ */
  extract: (overwrite?: boolean) => Promise<void>;
  /** validate แล้วส่ง POST/PATCH — คืนบิลที่บันทึกแล้ว หรือ null ถ้าไม่ผ่าน */
  submit: (overrides?: Partial<BillFormValues>) => Promise<Bill | null>;
};

const initial: State = {
  mode: "create",
  billId: null,
  values: emptyValues(),
  items: [emptyItem()],
  images: [],
  partner: null,
  aiData: null,
  errors: {},
  loading: false,
  loadError: null,
  submitting: false,
  submitError: null,
  savedAt: null,
  dirty: false,
  uploading: false,
  imageError: null,
  reading: false,
  aiMessage: null,
};

const round2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

export const useBillFormStore = create<State & Actions>()((set, get) => ({
  ...initial,

  startCreate: (contactId) => set({ ...initial, values: emptyValues(contactId), items: [emptyItem()] }),

  startReview: ({ values, items, partner, aiData }) =>
    set({
      ...initial,
      values: { ...emptyValues(), ...values, partnerId: partner?.id ?? null },
      items: items.length ? items.map((it) => ({ ...it, key: newKey() })) : [emptyItem()],
      partner,
      aiData,
    }),

  load: async (id) => {
    set({ ...initial, mode: "edit", billId: id, loading: true });
    try {
      const bill = await getBill(id);
      if (get().billId !== id) return; // เปลี่ยนหน้าไปแล้ว
      set({
        values: valuesFromBill(bill),
        items: bill.items.length ? bill.items.map(itemRowFromBill) : [emptyItem()],
        images: bill.images,
        partner: bill.partner,
        loading: false,
      });
    } catch (err) {
      if (get().billId === id) set({ loading: false, loadError: apiErrorMessage(err, "โหลดบิล") });
    }
  },

  setField: (key, value) =>
    set((st) => {
      const errors = { ...st.errors };
      delete errors[key];
      return { values: { ...st.values, [key]: value }, errors, dirty: true };
    }),

  setPartner: (partner) =>
    set((st) => ({ partner, values: { ...st.values, partnerId: partner?.id ?? null }, dirty: true })),

  addItem: () => set((st) => ({ items: [...st.items, emptyItem()], dirty: true })),

  // แก้จำนวนหรือราคาต่อหน่วย → จำนวนเงิน = จำนวน × ราคาต่อหน่วย (ทันที, ถ้าทั้งสองช่องเป็นตัวเลข)
  // แก้ช่องจำนวนเงินเองได้ (เช่น มีส่วนลดรายบรรทัด) — จะถูกคำนวณใหม่เมื่อแก้จำนวน/ราคาอีกครั้ง
  updateItem: (key, patch) =>
    set((st) => {
      const i = st.items.findIndex((it) => it.key === key);
      const errors = { ...st.errors };
      for (const f of Object.keys(patch)) delete errors[`items.${i}.${f as keyof ItemRow}`];
      const items = st.items.map((it) => {
        if (it.key !== key) return it;
        const next = { ...it, ...patch };
        if (("quantity" in patch || "unitPrice" in patch) && !("amount" in patch)) {
          const q = parseNumber(next.quantity);
          const p = parseNumber(next.unitPrice);
          if (q !== null && p !== null && !Number.isNaN(q) && !Number.isNaN(p)) {
            next.amount = round2(q * p);
            delete errors[`items.${i}.amount`];
          }
        }
        return next;
      });
      return { items, errors, dirty: true };
    }),

  removeItem: (key) =>
    set((st) => {
      const items = st.items.filter((it) => it.key !== key);
      return { items: items.length ? items : [emptyItem()], errors: {}, dirty: true };
    }),

  moveItem: (key, dir) =>
    set((st) => {
      const i = st.items.findIndex((it) => it.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= st.items.length) return {};
      const items = [...st.items];
      [items[i], items[j]] = [items[j], items[i]];
      return { items, errors: {}, dirty: true };
    }),

  calcItemAmount: (key) => {
    const it = get().items.find((x) => x.key === key);
    if (!it) return;
    const q = parseNumber(it.quantity);
    const p = parseNumber(it.unitPrice);
    if (q === null || p === null || Number.isNaN(q) || Number.isNaN(p)) return;
    get().updateItem(key, { amount: round2(q * p) });
  },

  sumItemsToSubtotal: () => {
    const amounts = get().items.map((it) => parseNumber(it.amount)).filter((n): n is number => n !== null && !Number.isNaN(n));
    if (amounts.length) get().setField("subtotal", round2(amounts.reduce((a, b) => a + b, 0)));
  },

  calcTotal: () => {
    const v = get().values;
    const sub = parseNumber(v.subtotal);
    if (sub === null || Number.isNaN(sub)) return;
    const disc = parseNumber(v.discount);
    const vat = parseNumber(v.vat);
    const total = sub - (disc && !Number.isNaN(disc) ? disc : 0) + (vat && !Number.isNaN(vat) ? vat : 0);
    get().setField("total", round2(total));
  },

  removeImage: async (imageId) => {
    const { billId, images } = get();
    if (!billId) return;
    try {
      await deleteBillImage(billId, imageId);
      set({ images: images.filter((img) => img.id !== imageId) });
    } catch (err) {
      set({ submitError: apiErrorMessage(err, "ลบรูป") });
    }
  },

  uploadImages: async (list) => {
    const { billId, images } = get();
    if (!billId) return;
    const problems: string[] = [];
    const room = MAX_IMAGES - images.length;
    const files = Array.from(list).filter((f) => {
      if (!(ACCEPTED_TYPES as readonly string[]).includes(f.type)) problems.push(`${f.name}: รองรับเฉพาะ JPG, PNG, WEBP`);
      else if (f.size > MAX_FILE_MB * 1024 * 1024) problems.push(`${f.name}: ใหญ่เกิน ${MAX_FILE_MB}MB`);
      else return true;
      return false;
    });
    if (files.length > room) problems.push(`เพิ่มได้อีก ${room} รูป (ไม่เพิ่ม ${files.length - room} รูป)`);

    set({ uploading: true, imageError: null });
    for (const file of files.slice(0, room)) {
      try {
        const img = await uploadBillImage(billId, file);
        set((st) => ({ images: [...st.images, img].sort((a, b) => a.position - b.position) }));
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof ApiError ? err.message : "อัปโหลดไม่สำเร็จ"}`);
      }
    }
    set({ uploading: false, imageError: problems.length ? problems.join(" · ") : null });
  },

  extract: async (overwrite = false) => {
    const { billId, dirty } = get();
    if (!billId) return;
    if (dirty && !window.confirm("มีการแก้ไขที่ยังไม่บันทึก — ให้ AI อ่านต่อเลย? (ค่าที่ยังไม่บันทึกจะหายไป)")) return;
    set({ reading: true, aiMessage: null });
    try {
      const { bill, ai } = await extractBill(billId, overwrite);
      set({
        values: valuesFromBill(bill),
        items: bill.items.length ? bill.items.map(itemRowFromBill) : [emptyItem()],
        images: bill.images,
        partner: bill.partner,
        errors: {},
        dirty: false,
        reading: false,
        aiMessage: !ai.isReceipt
          ? { tone: "error", text: "AI ไม่พบว่ารูปเป็นบิล/ใบเสร็จ" + (ai.notes ? ` (${ai.notes})` : "") }
          : {
              tone: "success",
              text:
                (ai.filled.length ? `AI เติมให้ ${ai.filled.length} ช่อง` : "AI อ่านแล้ว ไม่มีช่องว่างให้เติม") +
                (ai.partnerCreated && bill.partner ? ` · สร้างคู่ค้าใหม่ "${bill.partner.displayName}"` : "") +
                (ai.notes ? ` · หมายเหตุจาก AI: ${ai.notes}` : ""),
            },
      });
    } catch (err) {
      set({ reading: false, aiMessage: { tone: "error", text: apiErrorMessage(err, "ให้ AI อ่านบิล") } });
    }
  },

  submit: async (overrides) => {
    const st = get();
    const values = { ...st.values, ...overrides };
    const errors = validate(values, st.items, st.mode);
    set({ errors, submitError: null });
    if (Object.keys(errors).length) {
      set({ submitError: "กรุณาแก้ช่องที่มีกรอบสีแดง" });
      return null;
    }

    set({ submitting: true });
    try {
      const bill =
        st.mode === "create"
          ? await createBill(buildCreatePayload(values, st.items, st.aiData))
          : await updateBill(st.billId!, buildUpdatePayload(values, st.items));
      set({
        mode: "edit",
        billId: bill.id,
        values: valuesFromBill(bill),
        images: bill.images,
        partner: bill.partner,
        submitting: false,
        savedAt: Date.now(),
        dirty: false,
      });
      return bill;
    } catch (err) {
      set({ submitting: false, submitError: apiErrorMessage(err, "บันทึกบิล") });
      return null;
    }
  },
}));
