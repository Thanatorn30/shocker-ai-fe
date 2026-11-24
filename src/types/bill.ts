// ตรงกับ webchat-be prisma/schema.prisma (Bill / BillItem / BillImage / Partner / PartnerAlias)
// เงิน/จำนวน (Decimal) BE ส่งกลับเป็น string เช่น "1250.5"

export type BillDirection = "purchase" | "sale";
export type BillDocType = "delivery_note" | "receipt" | "tax_invoice" | "invoice" | "other";
export type BillStatus = "draft" | "confirmed" | "void";

export const DIRECTION_LABEL: Record<BillDirection, string> = {
  purchase: "บิลซื้อ",
  sale: "บิลขาย",
};

export const DOC_TYPE_LABEL: Record<BillDocType, string> = {
  delivery_note: "ใบส่งของ",
  receipt: "ใบเสร็จรับเงิน",
  tax_invoice: "ใบกำกับภาษี",
  invoice: "ใบแจ้งหนี้ / ใบวางบิล",
  other: "อื่นๆ",
};

export const STATUS_LABEL: Record<BillStatus, string> = {
  draft: "รอตรวจ",
  confirmed: "ยืนยันแล้ว",
  void: "ยกเลิก",
};

export interface PartnerRef {
  id: string;
  displayName: string;
  taxId: string | null;
}

export interface BillItem {
  id: string;
  billId: string;
  lineNo: number;
  name: string | null;
  quantity: string | null;
  unit: string | null;
  unitPrice: string | null;
  amount: string | null;
}

export interface BillImage {
  id: string;
  billId: string;
  position: number;
  imageKey: string | null;
  extractionId: string | null;
  createdAt: string;
  /** URL ชั่วคราว (5 นาที) — มีเฉพาะ GET/POST/PATCH บิลเดี่ยว */
  url?: string | null;
}

export interface Bill {
  id: string;
  /** ผู้ใช้ LINE ที่ส่งบิล — null = เพิ่มจากหน้าเว็บ */
  contactId: string | null;
  direction: BillDirection;
  docType: BillDocType;
  status: BillStatus;
  billNo: string | null;
  billDate: string | null; // ISO — ใช้ 10 ตัวแรก (YYYY-MM-DD)
  partnerNameRaw: string | null;
  partnerTaxIdRaw: string | null;
  partnerId: string | null;
  subtotal: string | null;
  discount: string | null;
  vat: string | null;
  total: string | null;
  paidAmount: string;
  currency: string;
  paymentMethod: string | null;
  note: string | null;
  /** ผลที่ AI อ่านจากรูปล่าสุด (ดิบ) */
  aiData: Record<string, unknown> | null;
  aiReadAt: string | null;
  confirmedAt: string | null;
  sheetSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  partner: PartnerRef | null;
  items: BillItem[];
  images: BillImage[];
}

/** แถวในหน้ารายการ (GET /api/bills) */
export interface BillListItem extends Omit<Bill, "items" | "images"> {
  images: Pick<BillImage, "id" | "position" | "imageKey">[];
  _count: { items: number };
}

export interface BillPage {
  items: BillListItem[];
  page: number;
  pageSize: number;
  total: number;
}

// ───────────────────────── payload ที่ส่งไป BE ─────────────────────────

/** number | string ตัวเลข | null (ล้างค่า) */
export type DecimalInput = number | string | null;

export interface BillItemInput {
  name?: string | null;
  quantity?: DecimalInput;
  unit?: string | null;
  unitPrice?: DecimalInput;
  amount?: DecimalInput;
}

export interface BillFieldsInput {
  direction?: BillDirection;
  docType?: BillDocType;
  status?: BillStatus;
  billNo?: string | null;
  billDate?: string | null; // YYYY-MM-DD ปี ค.ศ.
  partnerNameRaw?: string | null;
  partnerTaxIdRaw?: string | null;
  partnerId?: string | null;
  subtotal?: DecimalInput;
  discount?: DecimalInput;
  vat?: DecimalInput;
  total?: DecimalInput;
  paidAmount?: DecimalInput;
  currency?: string;
  paymentMethod?: string | null;
  note?: string | null;
}

/** POST /api/bills */
export interface CreateBillInput extends BillFieldsInput {
  /** ไม่ส่ง = เพิ่มจากหน้าเว็บ (ไม่ผูกผู้ใช้ LINE) */
  contactId?: string | null;
  direction: BillDirection;
  items?: BillItemInput[];
  /** รูปจาก LINE (receipt_extractions.id) สูงสุด 3 */
  extractionIds?: string[];
  /** ไม่มี partnerId: หาคู่ค้าชื่อนี้ ไม่เจอ = สร้างใหม่ */
  newPartnerName?: string;
  /** ผลดิบจาก POST /api/bills/read */
  aiData?: Record<string, unknown>;
}

/** PATCH /api/bills/:id — items ส่งมา = แทนที่ทั้งหมด */
export interface UpdateBillInput extends BillFieldsInput {
  items?: BillItemInput[];
  /** ค่าเริ่มต้น true: เลือก partnerId แล้วจำชื่อตามบิลเป็นชื่ออื่นของคู่ค้า */
  rememberAlias?: boolean;
}

export interface ListBillsParams {
  contactId?: string;
  direction?: BillDirection;
  status?: BillStatus;
  docType?: BillDocType;
  /** uuid หรือ "none" = ยังไม่ระบุคู่ค้า */
  partnerId?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

// ───────────────────────── คู่ค้า ─────────────────────────

export interface PartnerAlias {
  id: string;
  alias: string;
  rawName: string;
  createdAt: string;
}

export interface Partner {
  id: string;
  /** null = คู่ค้ากลาง */
  contactId: string | null;
  displayName: string;
  taxId: string | null;
  phone: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  aliases: PartnerAlias[];
  _count: { bills: number };
}

export interface CreatePartnerInput {
  /** ไม่ส่ง = คู่ค้ากลาง */
  contactId?: string | null;
  displayName: string;
  taxId?: string | null;
  phone?: string | null;
  note?: string | null;
  /** เช่น ชื่อตามบิล → จำเป็นชื่ออื่นของคู่ค้าใหม่ */
  aliasFrom?: string | null;
}

export type UpdatePartnerInput = Partial<Pick<CreatePartnerInput, "displayName" | "taxId" | "phone" | "note">>;

export interface PartnerCandidate {
  id: string;
  displayName: string;
  taxId: string | null;
  score: number;
}

/** POST /api/bills/read — รูปแบบรูปที่ส่ง (ย่อแล้ว, base64) */
export interface ReadImageInput {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
}

/** POST /api/bills/read — AI อ่านรูปโดยยังไม่บันทึก DB (เงิน = string, วันที่ = ISO) */
export interface ReadBillResult {
  ai: { model: string; isReceipt: boolean; notes: string | null };
  fields: {
    billNo: string | null;
    billDate: string | null;
    partnerNameRaw: string | null;
    partnerTaxIdRaw: string | null;
    subtotal: string | null;
    discount: string | null;
    vat: string | null;
    total: string | null;
    paymentMethod: string | null;
    currency: string | null;
    docType: BillDocType | null;
  };
  items: {
    lineNo: number;
    name: string | null;
    quantity: string | null;
    unit: string | null;
    unitPrice: string | null;
    amount: string | null;
  }[];
  partner: {
    name: string | null;
    taxId: string | null;
    /** คู่ค้าเดิมที่ตรงกับชื่อ/เลขภาษีในบิล */
    matched: (PartnerRef & { reason: "tax_id" | "alias" | "name" }) | null;
  };
  aiData: Record<string, unknown>;
}

/** POST /api/bills/:id/extract */
export interface ExtractBillResult {
  bill: Bill;
  ai: {
    model: string;
    isReceipt: boolean;
    /** ช่องที่ AI เติมให้ เช่น billNo, total, items, partnerId */
    filled: string[];
    /** true = สร้างคู่ค้าใหม่จากชื่อในบิล */
    partnerCreated: boolean;
    notes: string | null;
  };
}

export interface PartnerSuggestion {
  name: string;
  normalized: string;
  matched: { partnerId: string; reason: "tax_id" | "alias" } | null;
  candidates: PartnerCandidate[];
}
