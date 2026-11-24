"use client";

import { create } from "zustand";
import { ApiError } from "@/lib/api/client";
import { exportBills, type ExportBillsParams } from "@/lib/api/bills";
import type { BillFilters } from "./billListStore";
import type { BillDirection } from "@/types/bill";

// popup export .xlsx ในหน้า /bills: เลือกช่วงวันที่ (+ ใช้ตัวกรองของหน้ารายการ) → ดาวน์โหลดไฟล์

export type Preset = "thisMonth" | "lastMonth" | "last3Months" | "thisYear";

/** วันที่ตามเวลาเครื่องผู้ใช้ → "YYYY-MM-DD" */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function presetRange(p: Preset, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (p) {
    case "thisMonth":
      return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 0)) };
    case "lastMonth":
      return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
    case "last3Months":
      return { from: ymd(new Date(y, m - 2, 1)), to: ymd(new Date(y, m + 1, 0)) };
    case "thisYear":
      return { from: ymd(new Date(y, 0, 1)), to: ymd(new Date(y, 11, 31)) };
  }
}

type State = {
  open: boolean;
  from: string;
  to: string;
  /** "" = ทั้งบิลซื้อและบิลขาย */
  direction: BillDirection | "";
  /** ใช้ตัวกรองของหน้ารายการด้วย (ประเภท/สถานะ/เอกสาร/คู่ค้า/ค้นหา) */
  useListFilters: boolean;
  exporting: boolean;
  error: string | null;
  /** ไฟล์ล่าสุดที่ดาวน์โหลด */
  lastFile: string | null;
};

type Actions = {
  /** เปิด popup — ตั้งประเภทบิลตามตัวกรองของหน้ารายการเป็นค่าเริ่มต้น */
  openDialog: (listDirection?: BillDirection | "") => void;
  close: () => void;
  setRange: (patch: Partial<Pick<State, "from" | "to">>) => void;
  applyPreset: (p: Preset) => void;
  setUseListFilters: (v: boolean) => void;
  setDirection: (v: BillDirection | "") => void;
  /** ดาวน์โหลดไฟล์ — คืน true ถ้าสำเร็จ */
  run: (listFilters: BillFilters) => Promise<boolean>;
};

function validate(from: string, to: string): string | null {
  if (!from || !to) return "กรุณาเลือกวันที่เริ่มและวันที่สิ้นสุด";
  if (from > to) return "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด";
  const y1 = Number(from.slice(0, 4));
  const y2 = Number(to.slice(0, 4));
  if (y1 < 2000 || y2 > 2100) return "วันที่ต้องเป็นปี ค.ศ.";
  return null;
}

/** ให้เบราว์เซอร์ดาวน์โหลด Blob เป็นไฟล์ */
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const useExportStore = create<State & Actions>()((set, get) => ({
  open: false,
  ...presetRange("thisMonth"),
  direction: "",
  useListFilters: true,
  exporting: false,
  error: null,
  lastFile: null,

  openDialog: (listDirection = "") => set({ open: true, error: null, lastFile: null, direction: listDirection }),
  close: () => {
    if (!get().exporting) set({ open: false });
  },
  setRange: (patch) => set({ ...patch, error: null }),
  applyPreset: (p) => set({ ...presetRange(p), error: null }),
  setUseListFilters: (v) => set({ useListFilters: v }),
  setDirection: (v) => set({ direction: v }),

  run: async (listFilters) => {
    const { from, to, useListFilters, direction } = get();
    const problem = validate(from, to);
    if (problem) {
      set({ error: problem });
      return false;
    }

    // ช่วงวันที่และประเภทบิลใช้ของ popup เสมอ (ไม่ใช้ from/to/direction ของหน้ารายการ)
    const params: ExportBillsParams = { from, to, ...(direction ? { direction } : {}) };
    if (useListFilters) {
      const { contactId, status, docType, partnerId, q } = listFilters;
      Object.assign(params, {
        ...(contactId ? { contactId } : {}),
        ...(status ? { status } : {}),
        ...(docType ? { docType } : {}),
        ...(partnerId ? { partnerId } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
      });
    }

    set({ exporting: true, error: null });
    try {
      const { blob, filename } = await exportBills(params);
      saveBlob(blob, filename);
      set({ exporting: false, lastFile: filename });
      return true;
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 400
            ? err.message
            : `export ไม่สำเร็จ (${err.status}): ${err.message}`
          : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ หรือใช้เวลานานเกินไป";
      set({ exporting: false, error: message });
      return false;
    }
  },
}));
