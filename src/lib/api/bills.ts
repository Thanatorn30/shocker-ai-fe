import type {
  Bill,
  BillDirection,
  BillImage,
  BillPage,
  CreateBillInput,
  ExtractBillResult,
  ReadBillResult,
  ReadImageInput,
  ListBillsParams,
  UpdateBillInput,
} from "@/types/bill";
import { api } from "./client";

// API /api/bills — ตรงกับ webchat-be src/routes/bills.ts (ต้อง login)

const path = (id: string) => `/bills/${encodeURIComponent(id)}`;

/** GET /api/bills?contactId=&direction=&status=&docType=&partnerId=&from=&to=&q=&page=&pageSize= */
export function listBills(params: ListBillsParams = {}): Promise<BillPage> {
  return api.get<BillPage>("/bills", { params });
}

/** ตัวกรองสำหรับ export (from/to บังคับ) */
export type ExportBillsParams = Omit<ListBillsParams, "page" | "pageSize"> & { from: string; to: string };

/**
 * GET /api/bills/export → ไฟล์ .xlsx (บิล 1 แถว/ใบ + แถวรวมท้าย, รายการสินค้า, ข้อมูลการส่งออก)
 * ไม่ระบุ status = ไม่รวมบิลที่ยกเลิก
 */
export async function exportBills(params: ExportBillsParams): Promise<{ blob: Blob; filename: string }> {
  const blob = await api.get<Blob>("/bills/export", { params, responseType: "blob", timeout: 5 * 60_000 });
  const kind = params.direction === "purchase" ? "purchase-bills" : params.direction === "sale" ? "sale-bills" : "bills";
  const filename = `${kind}_${params.from.replace(/-/g, "")}-${params.to.replace(/-/g, "")}.xlsx`;
  return { blob, filename };
}

/** GET /api/bills/:id — รวม items + images (url ชั่วคราว) */
export function getBill(id: string): Promise<Bill> {
  return api.get<Bill>(path(id));
}

/** POST /api/bills */
export function createBill(input: CreateBillInput): Promise<Bill> {
  return api.post<Bill>("/bills", input);
}

/** PATCH /api/bills/:id */
export function updateBill(id: string, input: UpdateBillInput): Promise<Bill> {
  return api.patch<Bill>(path(id), input);
}

/** DELETE /api/bills/:id — ลบถาวร (owner) */
export function deleteBill(id: string): Promise<void> {
  return api.delete(path(id));
}

/** POST /api/bills/:id/images — แนบรูปจาก LINE */
export function addBillImage(id: string, extractionId: string): Promise<BillImage> {
  return api.post<BillImage>(`${path(id)}/images`, { extractionId });
}

/** POST /api/bills/:id/images/upload — ส่งไฟล์รูปทีละ 1 รูป (BE ย่อแล้วเก็บใน R2, สูงสุด 3 รูปต่อบิล) */
export function uploadBillImage(id: string, file: File): Promise<BillImage> {
  return api.post<BillImage>(`${path(id)}/images/upload`, file, { headers: { "Content-Type": file.type } });
}

/** POST /api/bills/read — ให้ AI อ่านรูป (1–3 รูป = บิลใบเดียว) โดยยังไม่บันทึกลง DB */
export function readBillImages(input: {
  direction: BillDirection;
  contactId?: string;
  images: ReadImageInput[];
}): Promise<ReadBillResult> {
  return api.post<ReadBillResult>("/bills/read", input);
}

/**
 * POST /api/bills/:id/extract — ให้ AI อ่านรูปทั้งหมดของบิลในครั้งเดียว
 * เติมช่องที่ว่าง + รายการ + คู่ค้า (ไม่ได้เลือก → หา/สร้างจากชื่อในบิล), overwrite = แทนที่ค่าที่มีอยู่
 */
export function extractBill(id: string, overwrite = false): Promise<ExtractBillResult> {
  return api.post<ExtractBillResult>(`${path(id)}/extract`, { overwrite });
}

/** DELETE /api/bills/:id/images/:imageId */
export function deleteBillImage(id: string, imageId: string): Promise<void> {
  return api.delete(`${path(id)}/images/${encodeURIComponent(imageId)}`);
}
