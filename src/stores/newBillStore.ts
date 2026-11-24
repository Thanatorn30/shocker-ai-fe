"use client";

import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import { readBillImages, uploadBillImage } from "@/lib/api/bills";
import { shrinkToBase64 } from "@/lib/image";
import { ALL_PARTNERS, usePartnerStore } from "./partnerStore";
import { useBillFormStore } from "./billFormStore";
import type { BillDirection, BillDocType, PartnerRef, ReadBillResult } from "@/types/bill";

// หน้าเพิ่มบิล 2 ขั้น:
// 1) select: คู่ค้า (ไม่บังคับ) + ประเภทบิล + ประเภทเอกสาร + วันที่ + รูป (1–3 รูป) → "ให้ AI อ่านบิล" (POST /api/bills/read — ยังไม่บันทึก DB)
// 2) review: ตารางข้อมูลที่ AI อ่านได้ (state อยู่ใน useBillFormStore) แก้ได้ → "บันทึก" = POST /api/bills แล้วอัปโหลดรูป

import { ACCEPTED_TYPES, MAX_FILE_MB, MAX_IMAGES } from "./billImageRules";
export { ACCEPTED_TYPES, MAX_FILE_MB, MAX_IMAGES };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NewBillValues = {
  partnerId: string; // "" = ไม่ระบุ (ให้ระบบใช้ชื่อในบิล)
  direction: BillDirection | "";
  docType: BillDocType;
  billDate: string; // YYYY-MM-DD (ปี ค.ศ.)
};

export type PickedImage = {
  key: string;
  file: File;
  previewUrl: string; // object URL — revoke เมื่อเอาออก/รีเซ็ต
  status: "pending" | "uploading" | "done" | "failed";
  error?: string;
};

export type Phase = "select" | "reading" | "review" | "saving" | "done";

type Errors = Partial<Record<keyof NewBillValues | "images", string>>;

type State = {
  phase: Phase;
  values: NewBillValues;
  images: PickedImage[];
  errors: Errors;
  error: string | null;
  /** ผลที่ AI อ่าน (ไว้แสดงหมายเหตุ/คู่ค้าที่ตรงกัน ในขั้นตรวจ) */
  readResult: ReadBillResult | null;
  /** บิลที่สร้างแล้ว (อัปโหลดรูปพังบางรูป → กดบันทึกอีกครั้ง = อัปโหลดต่อในบิลเดิม) */
  createdBillId: string | null;
};

type Actions = {
  reset: (partnerId?: string) => void;
  setField: <K extends keyof NewBillValues>(key: K, value: NewBillValues[K]) => void;
  addFiles: (files: FileList | File[]) => void;
  removeImage: (key: string) => void;
  /** ขั้น 1 → AI อ่านรูป (ไม่บันทึก DB) → ขั้น 2 */
  read: () => Promise<void>;
  /** กลับไปแก้รูป/ประเภท (ข้อมูลที่แก้ในตารางจะหาย เมื่ออ่านใหม่) */
  backToSelect: () => void;
  /** ขั้น 2 → สร้างบิลใน DB + อัปโหลดรูป — คืน id บิลเมื่อสำเร็จ */
  save: () => Promise<string | null>;
};

const emptyValues = (partnerId = ""): NewBillValues => ({ partnerId, direction: "", docType: "other", billDate: "" });

let seq = 0;

function validate(v: NewBillValues, images: PickedImage[]): Errors {
  const e: Errors = {};
  if (v.partnerId && !UUID_RE.test(v.partnerId)) e.partnerId = "คู่ค้าไม่ถูกต้อง";
  if (!v.direction) e.direction = "กรุณาเลือกบิลซื้อหรือบิลขาย";
  if (v.billDate) {
    const y = Number(v.billDate.slice(0, 4));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.billDate) || y < 2000 || y > 2100) e.billDate = "วันที่ต้องเป็นปี ค.ศ.";
  }
  if (images.length === 0) e.images = "กรุณาเลือกรูปบิลอย่างน้อย 1 รูป";
  return e;
}

function errorText(err: unknown, action: string): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return `${action}ไม่สำเร็จ: ${err.message}`;
    if (err.status === 413) return "รูปใหญ่เกินไป";
    if (err.status === 502) return err.message; // AI อ่านไม่สำเร็จ (BE แนบเหตุผลมา)
    if (err.status === 503) return "ระบบเก็บรูปยังไม่พร้อม (ยังไม่ได้ตั้งค่า R2)";
    return `${action}ไม่สำเร็จ (${err.status}): ${err.message}`;
  }
  if (err instanceof Error && err.message) return `${action}ไม่สำเร็จ: ${err.message}`;
  return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้";
}

const str = (v: string | null | undefined) => v ?? "";

export const useNewBillStore = create<State & Actions>()((set, get) => ({
  phase: "select",
  values: emptyValues(),
  images: [],
  errors: {},
  error: null,
  readResult: null,
  createdBillId: null,

  reset: (partnerId) => {
    for (const img of get().images) URL.revokeObjectURL(img.previewUrl);
    set({
      phase: "select",
      values: emptyValues(partnerId),
      images: [],
      errors: {},
      error: null,
      readResult: null,
      createdBillId: null,
    });
  },

  setField: (key, value) =>
    set((st) => {
      const errors = { ...st.errors };
      delete errors[key];
      return { values: { ...st.values, [key]: value }, errors };
    }),

  addFiles: (list) => {
    const st = get();
    const room = MAX_IMAGES - st.images.length;
    const problems: string[] = [];
    const accepted: PickedImage[] = [];
    for (const file of Array.from(list)) {
      if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
        problems.push(`${file.name}: รองรับเฉพาะ JPG, PNG, WEBP`);
      } else if (file.size > MAX_FILE_MB * 1024 * 1024) {
        problems.push(`${file.name}: ใหญ่เกิน ${MAX_FILE_MB}MB`);
      } else if (accepted.length >= room) {
        problems.push(`เลือกได้ไม่เกิน ${MAX_IMAGES} รูป (${file.name} ไม่ถูกเพิ่ม)`);
      } else {
        accepted.push({ key: `img-${++seq}`, file, previewUrl: URL.createObjectURL(file), status: "pending" });
      }
    }
    const errors = { ...st.errors };
    if (problems.length) errors.images = problems.join(" · ");
    else delete errors.images;
    set({ images: [...st.images, ...accepted], errors });
  },

  removeImage: (key) =>
    set((st) => {
      const img = st.images.find((i) => i.key === key);
      if (img) URL.revokeObjectURL(img.previewUrl);
      const errors = { ...st.errors };
      delete errors.images;
      return { images: st.images.filter((i) => i.key !== key), errors };
    }),

  read: async () => {
    const st = get();
    const errors = validate(st.values, st.images);
    set({ errors, error: null });
    if (Object.keys(errors).length) return;

    set({ phase: "reading" });
    try {
      const images = await Promise.all(st.images.map((img) => shrinkToBase64(img.file)));
      const v = st.values;
      const res = await readBillImages({ direction: v.direction as BillDirection, images });

      // คู่ค้า: ที่เลือกไว้ในขั้น 1 > คู่ค้าเดิมที่ตรงกับชื่อในบิล > สร้างใหม่จากชื่อในบิล (ผู้ใช้แก้ชื่อได้)
      let partner: PartnerRef | null = null;
      if (v.partnerId) {
        const p = usePartnerStore.getState().byContact[ALL_PARTNERS]?.find((x) => x.id === v.partnerId);
        partner = p ? { id: p.id, displayName: p.displayName, taxId: p.taxId } : null;
      } else if (res.partner.matched) {
        const m = res.partner.matched;
        partner = { id: m.id, displayName: m.displayName, taxId: m.taxId };
      }

      const f = res.fields;
      useBillFormStore.getState().startReview({
        values: {
          direction: v.direction as BillDirection,
          docType: v.docType !== "other" ? v.docType : (f.docType ?? "other"),
          billDate: v.billDate || (f.billDate ? f.billDate.slice(0, 10) : ""),
          billNo: str(f.billNo),
          partnerNameRaw: str(f.partnerNameRaw),
          partnerTaxIdRaw: str(f.partnerTaxIdRaw),
          subtotal: str(f.subtotal),
          discount: str(f.discount),
          vat: str(f.vat),
          total: str(f.total),
          currency: f.currency ?? "THB",
          paymentMethod: str(f.paymentMethod),
          newPartnerName: partner ? "" : str(f.partnerNameRaw),
        },
        items: res.items.map((it) => ({
          name: str(it.name),
          quantity: str(it.quantity),
          unit: str(it.unit),
          unitPrice: str(it.unitPrice),
          amount: str(it.amount),
        })),
        partner,
        aiData: res.aiData,
      });
      set({ phase: "review", readResult: res });
    } catch (err) {
      set({ phase: "select", error: errorText(err, "AI อ่านบิล") });
    }
  },

  backToSelect: () => set({ phase: "select", error: null, readResult: null }),

  save: async () => {
    set({ phase: "saving", error: null });
    let billId = get().createdBillId;

    // 1) สร้างบิลจากข้อมูลในตาราง (validate + payload อยู่ใน useBillFormStore)
    if (!billId) {
      const bill = await useBillFormStore.getState().submit();
      if (!bill) {
        set({ phase: "review" }); // error แสดงในตาราง (submitError / กรอบแดง)
        return null;
      }
      billId = bill.id;
      set({ createdBillId: billId });
    }

    // 2) อัปโหลดรูปทีละรูป (BE ย่อแล้วเก็บใน R2, จัดลำดับรูปที่ 1–3 ตามที่ส่ง)
    for (const img of get().images) {
      if (img.status === "done") continue;
      const update = (patch: Partial<PickedImage>) =>
        set((s) => ({ images: s.images.map((i) => (i.key === img.key ? { ...i, ...patch } : i)) }));
      update({ status: "uploading", error: undefined });
      try {
        await uploadBillImage(billId, img.file);
        update({ status: "done" });
      } catch (err) {
        update({ status: "failed", error: errorText(err, "อัปโหลด") });
      }
    }
    const failed = get().images.filter((i) => i.status === "failed").length;
    if (failed) {
      set({
        phase: "review",
        error: `บันทึกบิลแล้ว แต่อัปโหลดรูปไม่สำเร็จ ${failed} รูป — กด “บันทึก” อีกครั้งเพื่อลองใหม่ หรือไปหน้าบิล`,
      });
      return null;
    }
    set({ phase: "done" });
    return billId;
  },
}));
