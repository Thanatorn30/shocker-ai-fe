"use client";

import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import { deleteBill, listBills } from "@/lib/api/bills";
import type { BillDirection, BillDocType, BillListItem, BillStatus, ListBillsParams } from "@/types/bill";

// หน้ารายการบิล: ตัวกรอง + หน้า + ผลลัพธ์

export type BillFilters = {
  contactId: string;
  direction: BillDirection | "";
  status: BillStatus | "";
  docType: BillDocType | "";
  partnerId: string; // "" = ทั้งหมด, "none" = ยังไม่ระบุคู่ค้า, uuid
  from: string;
  to: string;
  q: string;
};

const emptyFilters: BillFilters = {
  contactId: "",
  direction: "",
  status: "",
  docType: "",
  partnerId: "",
  from: "",
  to: "",
  q: "",
};

type State = {
  filters: BillFilters;
  page: number;
  pageSize: number;
  items: BillListItem[];
  total: number;
  loading: boolean;
  error: string | null;
  /** id บิลที่กำลังลบ */
  deletingId: string | null;
};

type Actions = {
  setFilter: <K extends keyof BillFilters>(key: K, value: BillFilters[K]) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
  load: () => Promise<void>;
  /** ลบบิลถาวร (BE: owner เท่านั้น) แล้วโหลดหน้าปัจจุบันใหม่ — คืน true ถ้าสำเร็จ */
  remove: (id: string) => Promise<boolean>;
};

let requestSeq = 0;

function toParams(f: BillFilters, page: number, pageSize: number): ListBillsParams {
  const p: ListBillsParams = { page, pageSize };
  for (const [k, v] of Object.entries(f) as [keyof BillFilters, string][]) {
    const t = v.trim();
    if (t) (p as Record<string, string>)[k] = t;
  }
  return p;
}

export const useBillListStore = create<State & Actions>()((set, get) => ({
  filters: emptyFilters,
  page: 1,
  pageSize: 30,
  items: [],
  total: 0,
  loading: false,
  error: null,
  deletingId: null,

  // เปลี่ยนตัวกรอง → กลับไปหน้า 1 (เปลี่ยนลูกค้า → ล้างตัวกรองคู่ค้า เพราะคู่ค้าแยกตามลูกค้า)
  setFilter: (key, value) =>
    set((st) => ({
      filters: { ...st.filters, [key]: value, ...(key === "contactId" ? { partnerId: "" } : {}) },
      page: 1,
    })),

  resetFilters: () => set({ filters: emptyFilters, page: 1 }),

  setPage: (page) => set({ page }),

  load: async () => {
    const seq = ++requestSeq;
    const { filters, page, pageSize } = get();
    set({ loading: true, error: null });
    try {
      const res = await listBills(toParams(filters, page, pageSize));
      if (seq !== requestSeq) return; // มีคำขอใหม่กว่าแล้ว
      set({ items: res.items, total: res.total, loading: false });
    } catch (err) {
      if (seq !== requestSeq) return;
      const message =
        err instanceof ApiError ? `โหลดรายการไม่สำเร็จ (${err.status}): ${err.message}` : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้";
      set({ loading: false, error: message });
    }
  },

  remove: async (id) => {
    set({ deletingId: id, error: null });
    try {
      await deleteBill(id);
      const { items, page } = get();
      // ลบแถวสุดท้ายของหน้า (ที่ไม่ใช่หน้าแรก) → ถอยไปหน้าก่อน (การเปลี่ยนหน้าทำให้โหลดใหม่เอง)
      if (items.length === 1 && page > 1) set({ page: page - 1 });
      else await get().load();
      set({ deletingId: null });
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 403
            ? "ลบบิลได้เฉพาะ owner — ถ้าแค่ไม่ต้องการนับบิลนี้ ให้เปลี่ยนสถานะเป็น “ยกเลิก” ในหน้าแก้ไข"
            : err.status === 404
              ? "ไม่พบบิลนี้ (อาจถูกลบไปแล้ว)"
              : `ลบบิลไม่สำเร็จ (${err.status}): ${err.message}`
          : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้";
      set({ deletingId: null, error: message });
      return false;
    }
  },
}));
