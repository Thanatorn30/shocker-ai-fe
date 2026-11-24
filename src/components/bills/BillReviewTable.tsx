"use client";

import { useEffect, type ReactNode } from "react";
import { useBillFormStore } from "@/stores/billFormStore";
import { ALL_PARTNERS, usePartnerStore } from "@/stores/partnerStore";
import { DIRECTION_LABEL, DOC_TYPE_LABEL, type BillDocType, type ReadBillResult } from "@/types/bill";
import { BillItemsEditor } from "./BillItemsEditor";
import { btnLink, formatDate, inputClass } from "./ui";

const NEW_PARTNER = "__new__";

const PAYMENT_METHODS = [
  { value: "", label: "— ไม่ระบุ —" },
  { value: "cash", label: "เงินสด" },
  { value: "transfer", label: "โอนเงิน" },
  { value: "qr", label: "QR / พร้อมเพย์" },
  { value: "credit_card", label: "บัตรเครดิต" },
  { value: "credit", label: "เครดิต (ค้างจ่าย)" },
];

const MATCH_REASON = { tax_id: "เลขผู้เสียภาษีตรงกัน", alias: "เคยยืนยันชื่อนี้แล้ว", name: "ชื่อตรงกัน" } as const;

function Row({ label, htmlFor, error, children }: { label: string; htmlFor?: string; error?: string; children: ReactNode }) {
  return (
    <tr className="border-b border-zinc-100 last:border-0 align-top">
      <th scope="row" className="w-44 py-2 pr-4 pt-4 text-left text-sm font-medium text-zinc-600">
        <label htmlFor={htmlFor}>{label}</label>
      </th>
      <td className="py-2">
        {children}
        {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      </td>
    </tr>
  );
}

/** ขั้นตรวจก่อนบันทึก: ข้อมูลที่ AI อ่านจากรูป (state ใน useBillFormStore) แก้ได้ทุกช่อง */
export function BillReviewTable({ readResult }: { readResult: ReadBillResult | null }) {
  const v = useBillFormStore((s) => s.values);
  const errors = useBillFormStore((s) => s.errors);
  const partner = useBillFormStore((s) => s.partner);
  const set = useBillFormStore((s) => s.setField);
  const setPartner = useBillFormStore((s) => s.setPartner);
  const calcTotal = useBillFormStore((s) => s.calcTotal);

  const partners = usePartnerStore((s) => s.byContact[ALL_PARTNERS]);
  const loadPartners = usePartnerStore((s) => s.loadPartners);
  useEffect(() => {
    void loadPartners(ALL_PARTNERS);
  }, [loadPartners]);

  const matched = readResult?.partner.matched;
  const partnerValue = partner ? partner.id : v.newPartnerName.trim() ? NEW_PARTNER : "";
  // คู่ค้าที่เลือกอาจยังไม่อยู่ในรายการที่โหลด (เช่น เพิ่งสร้าง) → ใส่เป็นตัวเลือกให้ด้วย
  const options = partners ?? [];
  const showSelectedExtra = partner && !options.some((p) => p.id === partner.id);

  const money = (key: "subtotal" | "discount" | "vat" | "total", label: string) => (
    <Row label={label} htmlFor={`rv-${key}`} error={errors[key]}>
      <input
        id={`rv-${key}`}
        inputMode="decimal"
        value={v[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder="0.00"
        className={`${inputClass(errors[key])} max-w-xs text-right tabular-nums`}
      />
    </Row>
  );

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white px-5 py-2 shadow-sm">
        <table className="w-full text-sm">
          <tbody>
            <Row label="ประเภทบิล">
              <div className="pt-2 font-semibold text-zinc-900">{v.direction ? DIRECTION_LABEL[v.direction] : "-"}</div>
            </Row>
            <Row label="ประเภทเอกสาร" htmlFor="rv-docType">
              <select id="rv-docType" value={v.docType} onChange={(e) => set("docType", e.target.value as BillDocType)} className={`${inputClass()} max-w-xs`}>
                {(Object.keys(DOC_TYPE_LABEL) as BillDocType[]).map((t) => (
                  <option key={t} value={t}>
                    {DOC_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="เลขที่บิล" htmlFor="rv-billNo" error={errors.billNo}>
              <input id="rv-billNo" value={v.billNo} onChange={(e) => set("billNo", e.target.value)} maxLength={100} className={`${inputClass(errors.billNo)} max-w-xs`} />
            </Row>
            <Row label="วันที่ในบิล" htmlFor="rv-billDate" error={errors.billDate}>
              <div className="flex flex-wrap items-center gap-3">
                <input id="rv-billDate" type="date" value={v.billDate} onChange={(e) => set("billDate", e.target.value)} className={`${inputClass(errors.billDate)} max-w-xs`} />
                {v.billDate && <span className="text-xs text-zinc-500">{formatDate(v.billDate)}</span>}
              </div>
            </Row>
            <Row label={v.direction === "sale" ? "ชื่อลูกค้าตามบิล" : "ชื่อร้านตามบิล"} htmlFor="rv-partnerNameRaw" error={errors.partnerNameRaw}>
              <input id="rv-partnerNameRaw" value={v.partnerNameRaw} onChange={(e) => set("partnerNameRaw", e.target.value)} maxLength={255} className={inputClass(errors.partnerNameRaw)} />
            </Row>
            <Row label="เลขผู้เสียภาษีตามบิล" htmlFor="rv-partnerTaxIdRaw" error={errors.partnerTaxIdRaw}>
              <input id="rv-partnerTaxIdRaw" inputMode="numeric" value={v.partnerTaxIdRaw} onChange={(e) => set("partnerTaxIdRaw", e.target.value)} className={`${inputClass(errors.partnerTaxIdRaw)} max-w-xs`} />
            </Row>
            <Row label="คู่ค้า" htmlFor="rv-partner" error={errors.newPartnerName}>
              <select
                id="rv-partner"
                value={partnerValue}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id === NEW_PARTNER) {
                    setPartner(null);
                    set("newPartnerName", v.newPartnerName.trim() || v.partnerNameRaw.trim() || "คู่ค้าใหม่");
                  } else if (!id) {
                    setPartner(null);
                    set("newPartnerName", "");
                  } else {
                    const p = options.find((x) => x.id === id);
                    if (p) setPartner({ id: p.id, displayName: p.displayName, taxId: p.taxId });
                  }
                }}
                className={inputClass()}
              >
                <option value="">— ไม่ระบุคู่ค้า —</option>
                <option value={NEW_PARTNER}>+ สร้างคู่ค้าใหม่{v.partnerNameRaw.trim() ? ` (“${v.partnerNameRaw.trim()}”)` : ""}</option>
                {showSelectedExtra && <option value={partner.id}>{partner.displayName}</option>}
                {options.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                    {p.taxId ? ` · ${p.taxId}` : ""}
                  </option>
                ))}
              </select>
              {partnerValue === NEW_PARTNER && (
                <div className="mt-2">
                  <input
                    aria-label="ชื่อคู่ค้าใหม่"
                    value={v.newPartnerName}
                    onChange={(e) => set("newPartnerName", e.target.value)}
                    maxLength={255}
                    placeholder="ชื่อคู่ค้าที่จะสร้าง"
                    className={inputClass(errors.newPartnerName)}
                  />
                  <p className="mt-1 text-xs text-zinc-500">สร้างตอนกดบันทึก (ถ้ามีคู่ค้าชื่อนี้อยู่แล้ว จะใช้คู่ค้าเดิม)</p>
                </div>
              )}
              {matched && partner?.id === matched.id && (
                <p className="mt-1 text-xs text-emerald-700">ตรงกับคู่ค้าเดิม: {MATCH_REASON[matched.reason]}</p>
              )}
            </Row>
            {money("subtotal", "ยอดก่อน VAT")}
            {money("discount", "ส่วนลด")}
            {money("vat", "VAT")}
            <Row label="ยอดสุทธิ" htmlFor="rv-total" error={errors.total}>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="rv-total"
                  inputMode="decimal"
                  value={v.total}
                  onChange={(e) => set("total", e.target.value)}
                  placeholder="0.00"
                  className={`${inputClass(errors.total)} max-w-xs text-right font-semibold tabular-nums`}
                />
                <button type="button" className={btnLink} onClick={calcTotal}>
                  คำนวณ = ก่อน VAT − ส่วนลด + VAT
                </button>
              </div>
            </Row>
            <Row label="สกุลเงิน" htmlFor="rv-currency" error={errors.currency}>
              <input id="rv-currency" value={v.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} maxLength={3} className={`${inputClass(errors.currency)} w-24`} />
            </Row>
            <Row label="วิธีชำระ" htmlFor="rv-paymentMethod">
              <select id="rv-paymentMethod" value={v.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className={`${inputClass()} max-w-xs`}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
                {v.paymentMethod && !PAYMENT_METHODS.some((m) => m.value === v.paymentMethod) && <option value={v.paymentMethod}>{v.paymentMethod}</option>}
              </select>
            </Row>
            <Row label="หมายเหตุ" htmlFor="rv-note" error={errors.note}>
              <textarea id="rv-note" rows={2} value={v.note} onChange={(e) => set("note", e.target.value)} maxLength={2000} className={inputClass(errors.note)} />
            </Row>
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-zinc-900">รายการสินค้า</h3>
        <BillItemsEditor />
      </div>
    </div>
  );
}
