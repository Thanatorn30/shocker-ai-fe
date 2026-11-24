"use client";

import { useEffect, useMemo, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import { buildCreatePayload, buildUpdatePayload, useBillFormStore } from "@/stores/billFormStore";
import { deleteBill } from "@/lib/api/bills";
import { ApiError } from "@/lib/api/client";
import {
  DIRECTION_LABEL,
  DOC_TYPE_LABEL,
  STATUS_LABEL,
  type BillDirection,
  type BillDocType,
  type BillStatus,
} from "@/types/bill";
import { BillItemsEditor } from "./BillItemsEditor";
import { ContactSelect } from "./ContactSelect";
import { PartnerPicker } from "./PartnerPicker";
import { Alert, Card, Field, btnDanger, btnLink, btnPrimary, btnSecondary, formatDate, inputClass } from "./ui";

const PAYMENT_METHODS = [
  { value: "", label: "— ไม่ระบุ —" },
  { value: "cash", label: "เงินสด" },
  { value: "transfer", label: "โอนเงิน" },
  { value: "qr", label: "QR / พร้อมเพย์" },
  { value: "credit_card", label: "บัตรเครดิต" },
  { value: "credit", label: "เครดิต (ค้างจ่าย)" },
];

/** ฟอร์มสร้าง (billId ไม่ส่ง) / แก้ไขบิล — state ทั้งหมดอยู่ใน useBillFormStore */
export function BillForm({ billId, initialContactId }: { billId?: string; initialContactId?: string }) {
  const router = useRouter();
  const st = useBillFormStore();
  const { values: v, errors, mode } = st;

  useEffect(() => {
    if (billId) void st.load(billId);
    else st.startCreate(initialContactId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดใหม่เมื่อเปลี่ยนบิลเท่านั้น
  }, [billId, initialContactId]);

  // แสดง payload ที่จะส่งจริง (ช่วยตรวจว่าตรงกับที่ BE ต้องการ)
  const payload = useMemo(
    () => (mode === "create" ? buildCreatePayload(v, st.items) : buildUpdatePayload(v, st.items)),
    [mode, v, st.items],
  );

  if (st.loading) return <p className="text-sm text-zinc-500">กำลังโหลดบิล…</p>;
  if (st.loadError) return <Alert tone="error">{st.loadError}</Alert>;

  const save = async (status?: BillStatus) => {
    const bill = await st.submit(status ? { status } : undefined);
    if (bill && mode === "create") router.replace(`/bills/${bill.id}`);
  };

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    void save();
  };

  const onDelete = async () => {
    if (!st.billId || !window.confirm("ลบบิลนี้ถาวร? (รายการและการผูกรูปจะถูกลบด้วย กู้คืนไม่ได้)")) return;
    try {
      await deleteBill(st.billId);
      router.replace("/bills");
    } catch (err) {
      window.alert(
        err instanceof ApiError && err.status === 403 ? "ลบได้เฉพาะ owner — ใช้ “ยกเลิกบิล” แทน" : "ลบบิลไม่สำเร็จ",
      );
    }
  };

  const set = st.setField;
  const money = (key: "subtotal" | "discount" | "vat" | "total" | "paidAmount", label: string) => (
    <Field label={label} htmlFor={`bill-${key}`} error={errors[key]}>
      <input
        id={`bill-${key}`}
        inputMode="decimal"
        value={v[key]}
        onChange={(e) => set(key, e.target.value)}
        placeholder="0.00"
        className={inputClass(errors[key])}
      />
    </Field>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {st.submitError && <Alert tone="error">{st.submitError}</Alert>}
      {st.aiMessage && <Alert tone={st.aiMessage.tone}>{st.aiMessage.text}</Alert>}
      {st.savedAt && !st.dirty && <Alert tone="success">บันทึกแล้ว</Alert>}

      <Card title="ข้อมูลบิล">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* <Field label="ลูกค้า LINE ที่ส่งบิล" htmlFor="bill-contact" error={errors.contactId} hint="ไม่บังคับ · บิลที่เพิ่มจากหน้าเว็บไม่ผูกกับ LINE">
            <ContactSelect
              id="bill-contact"
              value={v.contactId}
              onChange={(id) => set("contactId", id)}
              disabled={mode === "edit"}
              error={errors.contactId}
              emptyLabel="— ไม่ผูก (เพิ่มจากหน้าเว็บ) —"
            />
          </Field> */}

          <fieldset>
            <legend className="mb-1 block text-sm font-medium text-zinc-700">
              ประเภทบิล<span className="ml-0.5 text-rose-500">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(DIRECTION_LABEL) as BillDirection[]).map((d) => (
                <label
                  key={d}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-semibold ${
                    v.direction === d ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  } ${errors.direction ? "border-rose-400" : ""}`}
                >
                  <input type="radio" name="direction" value={d} checked={v.direction === d} onChange={() => set("direction", d)} className="sr-only" />
                  {DIRECTION_LABEL[d]}
                </label>
              ))}
            </div>
            {errors.direction && <p className="mt-1 text-xs text-rose-600">{errors.direction}</p>}
          </fieldset>

          <Field label="ประเภทเอกสาร" htmlFor="bill-docType">
            <select id="bill-docType" value={v.docType} onChange={(e) => set("docType", e.target.value as BillDocType)} className={inputClass()}>
              {(Object.keys(DOC_TYPE_LABEL) as BillDocType[]).map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
{/* 
          <Field label="สถานะ" htmlFor="bill-status">
            <select id="bill-status" value={v.status} onChange={(e) => set("status", e.target.value as BillStatus)} className={inputClass()}>
              {(Object.keys(STATUS_LABEL) as BillStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field> */}

          <Field label="เลขที่บิล" htmlFor="bill-no" error={errors.billNo}>
            <input id="bill-no" value={v.billNo} onChange={(e) => set("billNo", e.target.value)} maxLength={100} className={inputClass(errors.billNo)} />
          </Field>

          <Field label="วันที่ในบิล" htmlFor="bill-date" error={errors.billDate} hint={v.billDate ? formatDate(v.billDate) : "ปี ค.ศ."}>
            <input id="bill-date" type="date" value={v.billDate} onChange={(e) => set("billDate", e.target.value)} className={inputClass(errors.billDate)} />
          </Field>
        </div>
      </Card>

      <Card title="คู่ค้า">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ชื่อตามบิล" htmlFor="bill-partnerNameRaw" error={errors.partnerNameRaw} hint="ชื่อร้าน/ผู้ขาย/ลูกค้าตามที่เขียนในบิล">
            <input
              id="bill-partnerNameRaw"
              value={v.partnerNameRaw}
              onChange={(e) => set("partnerNameRaw", e.target.value)}
              maxLength={255}
              className={inputClass(errors.partnerNameRaw)}
            />
          </Field>
          <Field label="เลขผู้เสียภาษีตามบิล" htmlFor="bill-partnerTaxIdRaw" error={errors.partnerTaxIdRaw} hint="13 หลัก (ถ้ามี)">
            <input
              id="bill-partnerTaxIdRaw"
              inputMode="numeric"
              value={v.partnerTaxIdRaw}
              onChange={(e) => set("partnerTaxIdRaw", e.target.value)}
              className={inputClass(errors.partnerTaxIdRaw)}
            />
          </Field>
        </div>
        <div className="mt-4">
          <PartnerPicker
            contactId={v.contactId}
            rawName={v.partnerNameRaw}
            rawTaxId={v.partnerTaxIdRaw}
            value={st.partner}
            onChange={st.setPartner}
          />
          {mode === "edit" && st.partner && v.partnerNameRaw.trim() && (
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={v.rememberAlias} onChange={(e) => set("rememberAlias", e.target.checked)} />
              จำว่า &quot;{v.partnerNameRaw.trim()}&quot; คือ {st.partner.displayName} (ครั้งต่อไปเสนอให้อัตโนมัติ)
            </label>
          )}
        </div>
      </Card>

      <Card title="รายการสินค้า">
        <BillItemsEditor />
      </Card>

      <Card title="ยอดเงิน">
        <div className="grid gap-4 sm:grid-cols-3">
          {money("subtotal", "ยอดก่อน VAT")}
          {money("discount", "ส่วนลด")}
          {money("vat", "VAT")}
          <div className="sm:col-span-1">{money("total", "ยอดสุทธิ")}</div>
          {money("paidAmount", v.direction === "sale" ? "รับเงินแล้ว" : "จ่ายแล้ว")}
        
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button type="button" className={btnLink} onClick={st.calcTotal}>
            คำนวณยอดสุทธิ = ก่อน VAT − ส่วนลด + VAT
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          
          <Field label="หมายเหตุ" htmlFor="bill-note" error={errors.note}>
            <textarea id="bill-note" rows={2} value={v.note} onChange={(e) => set("note", e.target.value)} maxLength={2000} className={inputClass(errors.note)} />
          </Field>
        </div>
      </Card>

      <Card title={`รูปบิล (${st.images.length}/3)`}>
        {mode === "edit" ? (
          <div className="space-y-3">
            {st.images.length < 3 && (
              <label className={`inline-flex cursor-pointer items-center ${btnSecondary} leading-10 ${st.uploading ? "pointer-events-none opacity-50" : ""}`}>
                {st.uploading ? "กำลังอัปโหลด…" : `+ เพิ่มรูป (ได้อีก ${3 - st.images.length} รูป)`}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  disabled={st.uploading}
                  onChange={(e) => {
                    if (e.target.files?.length) void st.uploadImages(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {st.images.some((img) => img.imageKey) && (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={btnSecondary} disabled={st.reading || st.uploading} onClick={() => void st.extract(false)}>
                  {st.reading ? "AI กำลังอ่านบิล…" : "ให้ AI อ่านรูป (เติมเฉพาะช่องว่าง)"}
                </button>
                <button
                  type="button"
                  className={btnLink}
                  disabled={st.reading || st.uploading}
                  onClick={() => window.confirm("ให้ AI อ่านใหม่และแทนที่ค่าที่กรอกไว้ทั้งหมด (รวมรายการสินค้า)?") && void st.extract(true)}
                >
                  อ่านใหม่และแทนที่ทั้งหมด
                </button>
              </div>
            )}
            {st.imageError && <p className="text-xs text-rose-600">{st.imageError}</p>}
          {st.images.length ? (
            <div className="grid grid-cols-3 gap-3">
              {st.images.map((img) => (
                <figure key={img.id} className="overflow-hidden rounded-lg border border-zinc-200">
                  {img.url ? (
                    <a href={img.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- URL ชั่วคราวจาก R2 */}
                      <img src={img.url} alt={`รูปบิลที่ ${img.position}`} className="aspect-[3/4] w-full bg-zinc-100 object-cover" />
                    </a>
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center bg-zinc-100 text-xs text-zinc-500">ไม่มีไฟล์รูป</div>
                  )}
                  <figcaption className="flex items-center justify-between px-2 py-1 text-xs text-zinc-600">
                    รูปที่ {img.position}
                    <button type="button" className="text-rose-500 hover:underline" onClick={() => window.confirm("เอารูปนี้ออกจากบิล?") && void st.removeImage(img.id)}>
                      เอาออก
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">ยังไม่มีรูป</p>
          )}
          </div>
        ) : (
          <Field
            label="id รูปจาก LINE (receipt_extractions.id)"
            htmlFor="bill-extractionIds"
            error={errors.extractionIds}
            hint="ไม่บังคับ · สูงสุด 3 รายการ คั่นด้วยเครื่องหมาย , หรือขึ้นบรรทัดใหม่"
          >
            <textarea
              id="bill-extractionIds"
              rows={2}
              value={v.extractionIds}
              onChange={(e) => set("extractionIds", e.target.value)}
              className={`${inputClass(errors.extractionIds)} font-mono text-xs`}
            />
          </Field>
        )}
      </Card>

    
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
        <button type="submit" className={btnPrimary} disabled={st.submitting}>
          {st.submitting ? "กำลังบันทึก…" : mode === "create" ? "สร้างบิล" : "บันทึก"}
        </button>
        {v.status !== "confirmed" && (
          <button type="button" className={btnSecondary} disabled={st.submitting} onClick={() => void save("confirmed")}>
            บันทึกและยืนยัน
          </button>
        )}
        {mode === "edit" && v.status !== "void" && (
          <button type="button" className={btnSecondary} disabled={st.submitting} onClick={() => window.confirm("ยกเลิกบิลนี้? (ไม่นับในยอดสรุป)") && void save("void")}>
            ยกเลิกบิล
          </button>
        )}
        {mode === "edit" && (
          <button type="button" className={`${btnDanger} ml-auto`} onClick={onDelete}>
            ลบถาวร
          </button>
        )}
      </div>
    </form>
  );
}
