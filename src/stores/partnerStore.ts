"use client";

import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import * as partnersApi from "@/lib/api/partners";
import { listConversations } from "@/lib/api/conversations";
import type { Contact } from "@/types/chat";
import type { CreatePartnerInput, Partner, PartnerSuggestion, UpdatePartnerInput } from "@/types/bill";

// คู่ค้า (แคชตาม contactId — "" = คู่ค้าทั้งหมด) + รายชื่อลูกค้า LINE สำหรับ dropdown

/** key แคชของคู่ค้าทั้งหมด */
export const ALL_PARTNERS = "";

export function partnerErrorMessage(err: unknown, action: string): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "มีคู่ค้าที่ใช้เลขผู้เสียภาษีนี้อยู่แล้ว";
    if (err.status === 403) return "ไม่มีสิทธิ์ทำรายการนี้ (ต้องเป็น owner)";
    if (err.status === 400) return `ข้อมูลไม่ถูกต้อง: ${err.message}`;
    return `${action}ไม่สำเร็จ (${err.status}): ${err.message}`;
  }
  return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";
}

type State = {
  contacts: Contact[];
  contactsLoaded: boolean;
  contactsError: string | null;
  /** contactId ("" = ทั้งหมด) → รายชื่อคู่ค้า */
  byContact: Record<string, Partner[]>;
  loading: Record<string, boolean>;
  error: Record<string, string | null>;
};

type Actions = {
  loadContacts: () => Promise<void>;
  loadPartners: (contactId: string, force?: boolean) => Promise<Partner[]>;
  suggest: (contactId: string, name: string, taxId?: string) => Promise<PartnerSuggestion | null>;
  create: (input: CreatePartnerInput) => Promise<Partner>;
  update: (id: string, input: UpdatePartnerInput) => Promise<Partner>;
  remove: (partner: Partner) => Promise<void>;
  addAlias: (partner: Partner, name: string) => Promise<void>;
  removeAlias: (partner: Partner, aliasId: string) => Promise<void>;
  merge: (into: Partner, fromId: string) => Promise<void>;
};

const MAX_CONTACT_PAGES = 10; // 100/หน้า → สูงสุด 1,000 ลูกค้า

export const usePartnerStore = create<State & Actions>()((set, get) => {
  // อัปเดตแคชทุกชุดที่คู่ค้านี้ควรอยู่: ของผู้ใช้ LINE คนนั้น + ทั้งหมด (คู่ค้ากลางอยู่ในทุกชุดที่โหลดแล้ว)
  const upsertIn = (list: Partner[] | undefined, p: Partner) => {
    if (!list) return undefined;
    const exists = list.some((x) => x.id === p.id);
    const next = exists ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p];
    return next.sort((a, b) => a.displayName.localeCompare(b.displayName, "th"));
  };
  // แก้เฉพาะชุดที่โหลดไว้แล้ว (ชุดที่ยังไม่โหลด ปล่อยให้โหลดจาก BE เองครั้งแรก)
  const replace = (p: Partner) =>
    set((st) => {
      const byContact = { ...st.byContact };
      for (const key of Object.keys(byContact)) {
        if (key === ALL_PARTNERS || !p.contactId || key === p.contactId) byContact[key] = upsertIn(byContact[key], p)!;
      }
      return { byContact };
    });
  const drop = (ids: string[]) =>
    set((st) => ({
      byContact: Object.fromEntries(
        Object.entries(st.byContact).map(([k, list]) => [k, list.filter((x) => !ids.includes(x.id))]),
      ),
    }));

  return {
    contacts: [],
    contactsLoaded: false,
    contactsError: null,
    byContact: {},
    loading: {},
    error: {},

    loadContacts: async () => {
      if (get().contactsLoaded) return;
      try {
        const contacts: Contact[] = [];
        let cursor: string | undefined;
        for (let i = 0; i < MAX_CONTACT_PAGES; i++) {
          const page = await listConversations({ limit: 100, cursor });
          contacts.push(...page.items.map((c) => c.contact));
          if (!page.nextCursor) break;
          cursor = page.nextCursor;
        }
        contacts.sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? "", "th"));
        set({ contacts, contactsLoaded: true, contactsError: null });
      } catch (err) {
        set({ contactsError: partnerErrorMessage(err, "โหลดรายชื่อลูกค้า") });
      }
    },

    loadPartners: async (contactId, force = false) => {
      const cached = get().byContact[contactId];
      if (cached && !force) return cached;
      set((st) => ({ loading: { ...st.loading, [contactId]: true }, error: { ...st.error, [contactId]: null } }));
      try {
        const list = await partnersApi.listPartners(contactId ? { contactId } : {});
        set((st) => ({
          byContact: { ...st.byContact, [contactId]: list },
          loading: { ...st.loading, [contactId]: false },
        }));
        return list;
      } catch (err) {
        set((st) => ({
          loading: { ...st.loading, [contactId]: false },
          error: { ...st.error, [contactId]: partnerErrorMessage(err, "โหลดคู่ค้า") },
        }));
        return [];
      }
    },

    suggest: async (contactId, name, taxId) => {
      try {
        return await partnersApi.suggestPartners({
          contactId: contactId || undefined,
          name: name.trim() || undefined,
          taxId: taxId?.replace(/\D/g, "").length === 13 ? taxId.replace(/\D/g, "") : undefined,
        });
      } catch {
        return null;
      }
    },

    create: async (input) => {
      const p = await partnersApi.createPartner(input);
      replace(p);
      return p;
    },

    update: async (id, input) => {
      const p = await partnersApi.updatePartner(id, input);
      replace(p);
      return p;
    },

    remove: async (partner) => {
      await partnersApi.deletePartner(partner.id);
      drop([partner.id]);
    },

    addAlias: async (partner, name) => {
      await partnersApi.addPartnerAlias(partner.id, name);
      replace(await partnersApi.getPartner(partner.id));
    },

    removeAlias: async (partner, aliasId) => {
      await partnersApi.deletePartnerAlias(partner.id, aliasId);
      replace(await partnersApi.getPartner(partner.id));
    },

    merge: async (into, fromId) => {
      const merged = await partnersApi.mergePartner(into.id, fromId);
      drop([fromId]);
      replace(merged);
    },
  };
});
