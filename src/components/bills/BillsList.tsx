"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useBillListStore } from "@/stores/billListStore";
import { usePartnerStore } from "@/stores/partnerStore";
import { DIRECTION_LABEL, DOC_TYPE_LABEL, STATUS_LABEL, type BillDirection, type BillDocType, type BillStatus } from "@/types/bill";
import { ContactSelect } from "./ContactSelect";
import { Alert, btnSecondary, formatDate, formatMoney, inputClass } from "./ui";

const statusTone: Record<BillStatus, string> = {
  draft: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  void: "bg-zinc-100 text-zinc-500 border-zinc-200",
};

export function BillsList() {
  const filters = useBillListStore((s) => s.filters);
  const page = useBillListStore((s) => s.page);
  const pageSize = useBillListStore((s) => s.pageSize);
  const items = useBillListStore((s) => s.items);
  const total = useBillListStore((s) => s.total);
  const loading = useBillListStore((s) => s.loading);
  const error = useBillListStore((s) => s.error);
  const setFilter = useBillListStore((s) => s.setFilter);
  const resetFilters = useBillListStore((s) => s.resetFilters);
  const setPage = useBillListStore((s) => s.setPage);
  const load = useBillListStore((s) => s.load);
  const remove = useBillListStore((s) => s.remove);
  const deletingId = useBillListStore((s) => s.deletingId);

  const partners = usePartnerStore((s) => s.byContact[filters.contactId]); // "" = คู่ค้าทั้งหมด
  const loadPartners = usePartnerStore((s) => s.loadPartners);

  // โหลดใหม่เมื่อตัวกรอง/หน้าเปลี่ยน (ช่องค้นหาหน่วง 300ms)
  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [filters, page, load]);

  useEffect(() => {
    void loadPartners(filters.contactId);
  }, [filters.contactId, loadPartners]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <ContactSelect value={filters.contactId} onChange={(id) => setFilter("contactId", id)} allowAll />
        <select aria-label="ประเภทบิล" value={filters.direction} onChange={(e) => setFilter("direction", e.target.value as BillDirection | "")} className={inputClass()}>
          <option value="">ซื้อและขาย</option>
          {(Object.keys(DIRECTION_LABEL) as BillDirection[]).map((d) => (
            <option key={d} value={d}>
              {DIRECTION_LABEL[d]}
            </option>
          ))}
        </select>
        <select aria-label="สถานะ" value={filters.status} onChange={(e) => setFilter("status", e.target.value as BillStatus | "")} className={inputClass()}>
          <option value="">ทุกสถานะ</option>
          {(Object.keys(STATUS_LABEL) as BillStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select aria-label="ประเภทเอกสาร" value={filters.docType} onChange={(e) => setFilter("docType", e.target.value as BillDocType | "")} className={inputClass()}>
          <option value="">ทุกประเภทเอกสาร</option>
          {(Object.keys(DOC_TYPE_LABEL) as BillDocType[]).map((t) => (
            <option key={t} value={t}>
              {DOC_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select aria-label="คู่ค้า" value={filters.partnerId} onChange={(e) => setFilter("partnerId", e.target.value)} className={inputClass()}>
          <option value="">ทุกคู่ค้า</option>
          <option value="none">ยังไม่ระบุคู่ค้า</option>
          {partners?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-500">
          ตั้งแต่
          <input type="date" aria-label="ตั้งแต่วันที่" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} className={inputClass()} />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-500">
          ถึง
          <input type="date" aria-label="ถึงวันที่" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} className={inputClass()} />
        </label>
        <div className="flex gap-2">
          <input aria-label="ค้นหา" placeholder="ค้นหาเลขที่ / ชื่อ / หมายเหตุ" value={filters.q} onChange={(e) => setFilter("q", e.target.value)} className={inputClass()} />
          <button type="button" className={btnSecondary} onClick={resetFilters} title="ล้างตัวกรอง">
            ล้าง
          </button>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-2">วันที่</th>
              <th className="px-4 py-2">ประเภท</th>
              <th className="px-4 py-2">เลขที่</th>
              <th className="px-4 py-2">คู่ค้า</th>
              <th className="px-4 py-2 text-right">ยอดสุทธิ</th>
              <th className="px-4 py-2 text-right">ค้าง</th>
              <th className="px-4 py-2">สถานะ</th>
              <th className="px-4 py-2">รูป</th>
              <th className="px-4 py-2 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => {
              const outstanding = b.total !== null ? Number(b.total) - Number(b.paidAmount) : null;
              return (
                <tr key={b.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50">
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link href={`/bills/${b.id}`} className="font-medium text-emerald-700 hover:underline">
                      {formatDate(b.billDate)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <div>{DIRECTION_LABEL[b.direction]}</div>
                    <div className="text-xs text-zinc-500">{DOC_TYPE_LABEL[b.docType]}</div>
                  </td>
                  <td className="px-4 py-2">{b.billNo ?? "-"}</td>
                  <td className="px-4 py-2">
                    {b.partner ? (
                      b.partner.displayName
                    ) : (
                      <span className="text-amber-700">ยังไม่ระบุ{b.partnerNameRaw ? ` (${b.partnerNameRaw})` : ""}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatMoney(b.total)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{outstanding && outstanding > 0 ? formatMoney(outstanding) : "-"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${statusTone[b.status]}`}>{STATUS_LABEL[b.status]}</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-500">{b.images.length || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/bills/${b.id}`}
                        className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        aria-label={`แก้ไขบิล ${b.billNo ?? formatDate(b.billDate)}`}
                      >
                        แก้ไข
                      </Link>
                      <button
                        type="button"
                        disabled={deletingId !== null}
                        onClick={() => {
                          const name = [b.billNo && `เลขที่ ${b.billNo}`, b.partner?.displayName ?? b.partnerNameRaw, formatMoney(b.total) + " บาท"]
                            .filter(Boolean)
                            .join(" · ");
                          if (window.confirm(`ลบบิลนี้ถาวร?\n${name}\n\nรายการสินค้าและการผูกรูปจะถูกลบด้วย กู้คืนไม่ได้`)) void remove(b.id);
                        }}
                        className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`ลบบิล ${b.billNo ?? formatDate(b.billDate)}`}
                      >
                        {deletingId === b.id ? "กำลังลบ…" : "ลบ"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-zinc-500">
                  ไม่พบบิล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-600">
        <span>{loading ? "กำลังโหลด…" : `ทั้งหมด ${total.toLocaleString("th-TH")} บิล`}</span>
        <div className="flex items-center gap-2">
          <button type="button" className={btnSecondary} disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            ก่อนหน้า
          </button>
          <span>
            หน้า {page} / {pages}
          </span>
          <button type="button" className={btnSecondary} disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>
            ถัดไป
          </button>
        </div>
      </div>
    </div>
  );
}
