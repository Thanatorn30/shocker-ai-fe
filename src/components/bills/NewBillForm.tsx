"use client";

import { useEffect, type SubmitEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ACCEPTED_TYPES, MAX_FILE_MB, MAX_IMAGES, useNewBillStore, type PickedImage } from "@/stores/newBillStore";
import { useBillFormStore } from "@/stores/billFormStore";
import { DIRECTION_LABEL, DOC_TYPE_LABEL, type BillDirection, type BillDocType } from "@/types/bill";
import { BillReviewTable } from "./BillReviewTable";
import { PartnerSelect } from "./PartnerSelect";
import { Alert, Card, Field, btnPrimary, btnSecondary, formatDate, inputClass } from "./ui";

const STATUS_TEXT = { pending: "", uploading: "กำลังอัปโหลด…", done: "อัปโหลดแล้ว ✓", failed: "ไม่สำเร็จ" } as const;

/**
 * เพิ่มบิล 2 ขั้น (ยังไม่บันทึก DB จนกด "บันทึก"):
 * 1) เลือกคู่ค้า (ไม่บังคับ) / ประเภทบิล / ประเภทเอกสาร / วันที่ + รูป 1–3 รูป → AI อ่าน
 * 2) ตารางข้อมูลที่ AI อ่านได้ แก้ไขได้ → บันทึก = สร้างบิล + คู่ค้าใหม่ (ถ้าเลือก) + อัปโหลดรูป
 */
export function NewBillForm({ initialPartnerId }: { initialPartnerId?: string }) {
  const router = useRouter();
  const phase = useNewBillStore((s) => s.phase);
  const error = useNewBillStore((s) => s.error);
  const createdBillId = useNewBillStore((s) => s.createdBillId);
  const reset = useNewBillStore((s) => s.reset);

  // เข้าหน้านี้ใหม่ = ฟอร์มว่าง (และคืนหน่วยความจำของรูปตัวอย่างตอนออกจากหน้า)
  useEffect(() => {
    reset(initialPartnerId);
    return () => reset();
  }, [initialPartnerId, reset]);

  const inReview = phase === "review" || phase === "saving" || phase === "done";

  return (
    <div className="space-y-5">
      <ol className="flex items-center gap-2 text-sm">
        <StepBadge n={1} label="เลือกรูปบิล" active={!inReview} done={inReview} />
        <span className="h-px w-8 bg-zinc-300" />
        <StepBadge n={2} label="ตรวจ/แก้ข้อมูล แล้วบันทึก" active={inReview} done={phase === "done"} />
      </ol>

      {error && (
        <Alert tone="error">
          {error}
          {createdBillId && (
            <>
              {" "}
              <Link href={`/bills/${createdBillId}`} className="font-medium underline">
                ไปหน้าบิล
              </Link>
            </>
          )}
        </Alert>
      )}

      {inReview ? <ReviewStep onSaved={(id) => router.push(`/bills/${id}`)} /> : <SelectStep onCancel={() => router.push("/bills")} />}
    </div>
  );
}

function StepBadge({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${active ? "font-semibold text-zinc-900" : "text-zinc-400"}`} aria-current={active ? "step" : undefined}>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
          done ? "bg-emerald-600 text-white" : active ? "border-2 border-emerald-600 text-emerald-700" : "border border-zinc-300"
        }`}
      >
        {done ? "✓" : n}
      </span>
      {label}
    </li>
  );
}

// ───────────────────────── ขั้น 1: เลือกรูป ─────────────────────────

function SelectStep({ onCancel }: { onCancel: () => void }) {
  const phase = useNewBillStore((s) => s.phase);
  const values = useNewBillStore((s) => s.values);
  const images = useNewBillStore((s) => s.images);
  const errors = useNewBillStore((s) => s.errors);
  const setField = useNewBillStore((s) => s.setField);
  const addFiles = useNewBillStore((s) => s.addFiles);
  const removeImage = useNewBillStore((s) => s.removeImage);
  const read = useNewBillStore((s) => s.read);

  const reading = phase === "reading";
  const room = MAX_IMAGES - images.length;

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    void read();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Card title="ข้อมูลบิล">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="คู่ค้า"
            htmlFor="nb-partner"
            error={errors.partnerId}
            hint={values.partnerId ? undefined : "ไม่เลือก = ใช้ชื่อร้าน/ลูกค้าในบิลที่ AI อ่านได้ (เลือก/แก้ได้ในขั้นถัดไป)"}
          >
            <PartnerSelect
              id="nb-partner"
              value={values.partnerId}
              onChange={(id) => setField("partnerId", id)}
              disabled={reading}
              error={errors.partnerId}
              emptyLabel="— ไม่ระบุ (ใช้ชื่อในบิล) —"
            />
          </Field>

          <fieldset disabled={reading}>
            <legend className="mb-1 block text-sm font-medium text-zinc-700">
              ประเภทบิล<span className="ml-0.5 text-rose-500">*</span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(DIRECTION_LABEL) as BillDirection[]).map((d) => (
                <label
                  key={d}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-semibold ${
                    values.direction === d
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                      : `bg-white text-zinc-700 hover:bg-zinc-50 ${errors.direction ? "border-rose-400" : "border-zinc-200"}`
                  }`}
                >
                  <input type="radio" name="direction" value={d} checked={values.direction === d} onChange={() => setField("direction", d)} className="sr-only" />
                  {DIRECTION_LABEL[d]}
                </label>
              ))}
            </div>
            {errors.direction && <p className="mt-1 text-xs text-rose-600">{errors.direction}</p>}
          </fieldset>

          <Field label="ประเภทเอกสาร" htmlFor="nb-docType" hint={values.docType === "other" ? "เลือก “อื่นๆ” = ให้ AI ระบุจากรูป" : undefined}>
            <select id="nb-docType" value={values.docType} onChange={(e) => setField("docType", e.target.value as BillDocType)} disabled={reading} className={inputClass()}>
              {(Object.keys(DOC_TYPE_LABEL) as BillDocType[]).map((t) => (
                <option key={t} value={t}>
                  {DOC_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="วันที่ในบิล" htmlFor="nb-date" error={errors.billDate} hint={values.billDate ? formatDate(values.billDate) : "ไม่บังคับ · ว่าง = ใช้วันที่ที่ AI อ่านได้"}>
            <input id="nb-date" type="date" value={values.billDate} onChange={(e) => setField("billDate", e.target.value)} disabled={reading} className={inputClass(errors.billDate)} />
          </Field>
        </div>
      </Card>

      <Card title={`รูปบิล (${images.length}/${MAX_IMAGES})`}>
        <input
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          className="sr-only"
          id="nb-files"
          disabled={reading}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = ""; // เลือกไฟล์เดิมซ้ำได้
          }}
        />
        <ImageGrid images={images} onRemove={reading ? undefined : removeImage} />

        {room > 0 ? (
          <label
            htmlFor="nb-files"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!reading && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center ${
              errors.images ? "border-rose-300 bg-rose-50" : "border-zinc-300 bg-zinc-50 hover:border-emerald-400 hover:bg-emerald-50"
            }`}
          >
            <span className="text-sm font-medium text-zinc-700">คลิกเพื่อเลือกรูป หรือลากรูปมาวาง</span>
            <span className="mt-1 text-xs text-zinc-500">
              เลือกได้อีก {room} รูป (พร้อมกันได้) · รูปทั้งหมด = บิลใบเดียว · JPG, PNG, WEBP ไม่เกิน {MAX_FILE_MB}MB ต่อรูป
            </span>
          </label>
        ) : (
          <p className="text-sm text-zinc-500">ครบ {MAX_IMAGES} รูปแล้ว — เอารูปออกก่อนถ้าต้องการเปลี่ยน</p>
        )}
        {errors.images && <p className="mt-2 text-xs text-rose-600">{errors.images}</p>}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={btnPrimary} disabled={reading}>
          {reading ? "AI กำลังอ่านบิล…" : "ให้ AI อ่านบิล →"}
        </button>
        <button type="button" className={btnSecondary} disabled={reading} onClick={onCancel}>
          ยกเลิก
        </button>
        <span className="text-xs text-zinc-500">
          {reading ? "กำลังย่อรูปและให้ AI อ่าน (ประมาณ 5–30 วินาที)" : "ยังไม่บันทึกลงระบบ — ตรวจ/แก้ข้อมูลได้ก่อนในขั้นถัดไป"}
        </span>
      </div>
    </form>
  );
}

// ───────────────────────── ขั้น 2: ตรวจ/แก้ แล้วบันทึก ─────────────────────────

function ReviewStep({ onSaved }: { onSaved: (billId: string) => void }) {
  const phase = useNewBillStore((s) => s.phase);
  const images = useNewBillStore((s) => s.images);
  const readResult = useNewBillStore((s) => s.readResult);
  const createdBillId = useNewBillStore((s) => s.createdBillId);
  const backToSelect = useNewBillStore((s) => s.backToSelect);
  const save = useNewBillStore((s) => s.save);
  const formError = useBillFormStore((s) => s.submitError);

  const saving = phase === "saving" || phase === "done";

  const onSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const id = await save();
    if (id) onSaved(id);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {readResult && !readResult.ai.isReceipt && (
        <Alert tone="error">AI ไม่พบว่ารูปเป็นบิล/ใบเสร็จ — ตรวจรูปอีกครั้ง หรือกรอกข้อมูลเองในตารางด้านล่าง</Alert>
      )}
      {readResult?.ai.notes && <Alert tone="info">หมายเหตุจาก AI: {readResult.ai.notes}</Alert>}
      {formError && !createdBillId && <Alert tone="error">{formError}</Alert>}

      <Card title="รูปที่อ่าน">
        <ImageGrid images={images} compact />
      </Card>

      <BillReviewTable readResult={readResult} />

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur">
        <button type="submit" className={btnPrimary} disabled={saving}>
          {saving ? (images.some((i) => i.status === "uploading") ? "กำลังอัปโหลดรูป…" : "กำลังบันทึก…") : createdBillId ? "อัปโหลดรูปที่เหลือ" : "บันทึก"}
        </button>
        {!createdBillId && (
          <button
            type="button"
            className={btnSecondary}
            disabled={saving}
            onClick={() => window.confirm("กลับไปแก้รูป/ประเภทบิล? ข้อมูลที่แก้ในตารางจะหาย เมื่อให้ AI อ่านใหม่") && backToSelect()}
          >
            ← กลับไปแก้รูป
          </button>
        )}
        <span className="text-xs text-zinc-500">กด “บันทึก” แล้วจึงสร้างบิลในระบบ</span>
      </div>
    </form>
  );
}

function ImageGrid({ images, onRemove, compact }: { images: PickedImage[]; onRemove?: (key: string) => void; compact?: boolean }) {
  if (images.length === 0) return null;
  return (
    <div className={`grid grid-cols-3 gap-3 ${compact ? "max-w-md" : "mb-4"}`}>
      {images.map((img, i) => (
        <figure key={img.key} className={`overflow-hidden rounded-lg border ${img.status === "failed" ? "border-rose-300" : "border-zinc-200"}`}>
          <a href={img.previewUrl} target="_blank" rel="noreferrer" title="เปิดรูปเต็ม">
            {/* eslint-disable-next-line @next/next/no-img-element -- ตัวอย่างจากไฟล์ในเครื่อง (blob:) */}
            <img src={img.previewUrl} alt={`รูปที่ ${i + 1}`} className="aspect-[3/4] w-full bg-zinc-100 object-cover" />
          </a>
          <figcaption className="space-y-0.5 px-2 py-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-zinc-600" title={img.file.name}>
                {i + 1}. {img.file.name}
              </span>
              {onRemove && img.status !== "done" && img.status !== "uploading" && (
                <button type="button" className="shrink-0 text-rose-500 hover:underline" onClick={() => onRemove(img.key)}>
                  เอาออก
                </button>
              )}
            </div>
            <div className="text-zinc-400">
              {(img.file.size / 1024 / 1024).toFixed(1)}MB
              {STATUS_TEXT[img.status] && (
                <span className={`ml-1 ${img.status === "failed" ? "text-rose-600" : img.status === "done" ? "text-emerald-600" : ""}`}>
                  · {STATUS_TEXT[img.status]}
                </span>
              )}
            </div>
            {img.error && <div className="text-rose-600">{img.error}</div>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
