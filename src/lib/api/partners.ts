import type {
  CreatePartnerInput,
  Partner,
  PartnerAlias,
  PartnerSuggestion,
  UpdatePartnerInput,
} from "@/types/bill";
import { api } from "./client";

// API /api/partners — ตรงกับ webchat-be src/routes/partners.ts (ต้อง login)

const path = (id: string) => `/partners/${encodeURIComponent(id)}`;

/** GET /api/partners?contactId=&q= — ไม่ส่ง contactId = คู่ค้าทั้งหมด */
export async function listPartners(params: { contactId?: string; q?: string } = {}): Promise<Partner[]> {
  return (await api.get<{ items: Partner[] }>("/partners", { params })).items;
}

/** GET /api/partners/suggest?contactId=&name=&taxId= — ตัวเลือกคู่ค้า (ระบบไม่เลือกให้เอง) */
export function suggestPartners(params: { contactId?: string; name?: string; taxId?: string }): Promise<PartnerSuggestion> {
  return api.get<PartnerSuggestion>("/partners/suggest", { params });
}

/** GET /api/partners/:id */
export function getPartner(id: string): Promise<Partner> {
  return api.get<Partner>(path(id));
}

/** POST /api/partners */
export function createPartner(input: CreatePartnerInput): Promise<Partner> {
  return api.post<Partner>("/partners", input);
}

/** PATCH /api/partners/:id */
export function updatePartner(id: string, input: UpdatePartnerInput): Promise<Partner> {
  return api.patch<Partner>(path(id), input);
}

/** DELETE /api/partners/:id (owner) */
export function deletePartner(id: string): Promise<void> {
  return api.delete(path(id));
}

/** POST /api/partners/:id/aliases */
export function addPartnerAlias(id: string, name: string): Promise<PartnerAlias> {
  return api.post<PartnerAlias>(`${path(id)}/aliases`, { name });
}

/** DELETE /api/partners/:id/aliases/:aliasId */
export function deletePartnerAlias(id: string, aliasId: string): Promise<void> {
  return api.delete(`${path(id)}/aliases/${encodeURIComponent(aliasId)}`);
}

/** POST /api/partners/:id/merge — รวม fromPartnerId เข้ามาที่ :id */
export function mergePartner(id: string, fromPartnerId: string): Promise<Partner> {
  return api.post<Partner>(`${path(id)}/merge`, { fromPartnerId });
}
