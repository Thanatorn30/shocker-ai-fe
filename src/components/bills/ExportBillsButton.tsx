"use client";

import { useEffect, useRef } from "react";
import { useBillListStore } from "@/stores/billListStore";
import { useExportStore, type Preset } from "@/stores/exportStore";
import {
  DIRECTION_LABEL,
  DOC_TYPE_LABEL,
  STATUS_LABEL,
  type BillDirection,
} from "@/types/bill";
import {
  Alert,
  Field,
  btnPrimary,
  btnSecondary,
  formatDate,
  inputClass,
} from "./ui";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "thisMonth", label: "เดือนนี้" },
  { key: "lastMonth", label: "เดือนที่แล้ว" },
  { key: "last3Months", label: "3 เดือนล่าสุด" },
  { key: "thisYear", label: "ปีนี้" },
];

/** ปุ่ม "Export .xlsx" + popup เลือกช่วงเวลา (หน้า /bills) */
export function ExportBillsButton() {
  const open = useExportStore((s) => s.open);
  const openDialog = useExportStore((s) => s.openDialog);
  const listDirection = useBillListStore((s) => s.filters.direction);

  return (
    <>
      <button
        type="button"
        className={`${btnSecondary} inline-flex items-center gap-1.5`}
        onClick={() => openDialog(listDirection)}
      >
        <span aria-hidden>⬇</span> Export .xlsx
      </button>
      {open && <ExportDialog />}
    </>
  );
}

function ExportDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const from = useExportStore((s) => s.from);
  const to = useExportStore((s) => s.to);
  const useListFilters = useExportStore((s) => s.useListFilters);
  const direction = useExportStore((s) => s.direction);
  const setDirection = useExportStore((s) => s.setDirection);
  const exporting = useExportStore((s) => s.exporting);
  const error = useExportStore((s) => s.error);
  const lastFile = useExportStore((s) => s.lastFile);
  const close = useExportStore((s) => s.close);
  const setRange = useExportStore((s) => s.setRange);
  const applyPreset = useExportStore((s) => s.applyPreset);
  const setUseListFilters = useExportStore((s) => s.setUseListFilters);
  const run = useExportStore((s) => s.run);
  const filters = useBillListStore((s) => s.filters);

  // เปิดเป็น modal (โฟกัสอยู่ใน popup, Esc ปิดได้)
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  // ตัวกรองของหน้ารายการที่จะใช้ร่วม (ไม่รวมช่วงวันที่/ประเภทบิล — เลือกใน popup นี้)
  const active = [
    filters.contactId && "ลูกค้า LINE ที่เลือก",
    filters.status && `สถานะ: ${STATUS_LABEL[filters.status]}`,
    filters.docType && DOC_TYPE_LABEL[filters.docType],
    filters.partnerId === "none"
      ? "ยังไม่ระบุคู่ค้า"
      : filters.partnerId && "คู่ค้าที่เลือก",
    filters.q.trim() && `ค้นหา “${filters.q.trim()}”`,
  ].filter(Boolean) as string[];

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === dialog.current && close()} // คลิกพื้นหลังปิด
      aria-labelledby="export-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-zinc-900/40"
    >
      <form
        method="dialog"
        className="space-y-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          await run(filters);
        }}
      >
        <div>
          <h2 id="export-title" className="text-lg font-semibold text-zinc-900">
            Export {direction ? DIRECTION_LABEL[direction] : "บิล"}เป็น .xlsx
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            เลือกช่วงวันที่ในบิล — ไฟล์มีทุกรายการ พร้อมแถวผลรวมท้ายตาราง
          </p>
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-zinc-700">
            ประเภทบิล
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["", "ทั้งหมด"],
                ["purchase", DIRECTION_LABEL.purchase],
                ["sale", DIRECTION_LABEL.sale],
              ] as [BillDirection | "", string][]
            ).map(([value, label]) => (
              <label
                key={value || "all"}
                className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-semibold ${
                  direction === value
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <input
                  type="radio"
                  name="export-direction"
                  value={value}
                  checked={direction === value}
                  onChange={() => setDirection(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:border-emerald-400 hover:bg-emerald-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="ตั้งแต่วันที่"
            htmlFor="ex-from"
            hint={from ? formatDate(from) : undefined}
          >
            <input
              id="ex-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setRange({ from: e.target.value })}
              className={inputClass()}
            />
          </Field>
          <Field
            label="ถึงวันที่"
            htmlFor="ex-to"
            hint={to ? formatDate(to) : undefined}
          >
            <input
              id="ex-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setRange({ to: e.target.value })}
              className={inputClass()}
            />
          </Field>
        </div>

        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={useListFilters}
            onChange={(e) => setUseListFilters(e.target.checked)}
          />
          <span>
            ใช้ตัวกรองที่เลือกในหน้ารายการด้วย
            <span className="block text-xs text-zinc-500">
              {active.length
                ? active.join(" · ")
                : "ตอนนี้ไม่มีตัวกรอง (ส่งออกทุกบิลในช่วงวันที่)"}
            </span>
          </span>
        </label>
        <p className="text-xs text-zinc-500">
          {filters.status && useListFilters ? "" : "ไม่รวมบิลที่ยกเลิก · "}
          บิลที่ยังไม่มีวันที่ในบิลจะไม่ถูกรวม
        </p>

        {error && <Alert tone="error">{error}</Alert>}
        {lastFile && !error && (
          <Alert tone="success">ดาวน์โหลด {lastFile} แล้ว</Alert>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className={btnSecondary}
            onClick={close}
            disabled={exporting}
          >
            ปิด
          </button>
          <button type="submit" className={btnPrimary} disabled={exporting}>
            {exporting ? "กำลังสร้างไฟล์…" : "Export"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
