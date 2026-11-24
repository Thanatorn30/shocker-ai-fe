"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { partnerErrorMessage, usePartnerStore } from "@/stores/partnerStore";
import type { Partner } from "@/types/bill";
import { ContactSelect } from "@/components/bills/ContactSelect";
import {
  Alert,
  Card,
  Field,
  btnDanger,
  btnLink,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/bills/ui";

const EMPTY: Partner[] = [];

/** ตรวจค่าก่อนส่ง (กติกาเดียวกับ BE) */
function checkPartner(f: {
  displayName: string;
  taxId: string;
  phone: string;
}) {
  const e: Partial<Record<"displayName" | "taxId" | "phone", string>> = {};
  if (!f.displayName.trim()) e.displayName = "กรุณาตั้งชื่อคู่ค้า";
  else if (f.displayName.trim().length > 255)
    e.displayName = "ยาวได้ไม่เกิน 255 ตัวอักษร";
  if (f.taxId.trim() && f.taxId.replace(/\D/g, "").length !== 13)
    e.taxId = "ต้องมี 13 หลัก";
  if (f.phone.trim().length > 20) e.phone = "ยาวได้ไม่เกิน 20 ตัวอักษร";
  return e;
}

export function PartnersManager() {
  const [contactId, setContactId] = useState("");
  // contactId "" = คู่ค้าทั้งหมด (เพิ่มใหม่ = คู่ค้ากลาง)
  const partners = usePartnerStore((s) => s.byContact[contactId] ?? EMPTY);
  const loading = usePartnerStore((s) => !!s.loading[contactId]);
  const loadError = usePartnerStore((s) => s.error[contactId]);
  const loadPartners = usePartnerStore((s) => s.loadPartners);
  const create = usePartnerStore((s) => s.create);

  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    displayName: "",
    taxId: "",
    phone: "",
    note: "",
  });
  const [errors, setErrors] = useState<ReturnType<typeof checkPartner>>({});
  const [msg, setMsg] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadPartners(contactId, true);
  }, [contactId, loadPartners]);

  const onCreate = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs = checkPartner(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setMsg(null);
    try {
      const p = await create({
        contactId: contactId || null,
        displayName: form.displayName.trim(),
        taxId: form.taxId.replace(/\D/g, "") || null,
        phone: form.phone.trim() || null,
        note: form.note.trim() || null,
      });
      setForm({ displayName: "", taxId: "", phone: "", note: "" });
      setMsg({ tone: "success", text: `สร้างคู่ค้า ${p.displayName} แล้ว` });
    } catch (err) {
      setMsg({ tone: "error", text: partnerErrorMessage(err, "สร้างคู่ค้า") });
    } finally {
      setBusy(false);
    }
  };

  const needle = q.trim().toLowerCase();
  const shown = needle
    ? partners.filter(
        (p) =>
          p.displayName.toLowerCase().includes(needle) ||
          p.taxId?.includes(needle) ||
          p.aliases.some(
            (a) =>
              a.rawName.toLowerCase().includes(needle) ||
              a.alias.includes(needle),
          ),
      )
    : partners;

  return (
    <div className="space-y-5">
      <Card>
        <Field
          label="แสดงคู่ค้าของ"
          htmlFor="partners-contact"
          hint="ทั้งหมด = คู่ค้ากลาง (ใช้ได้ทุกบิล) + คู่ค้าของลูกค้า LINE ทุกคน"
        >
          <ContactSelect
            id="partners-contact"
            value={contactId}
            onChange={setContactId}
            emptyLabel="คู่ค้าทั้งหมด"
          />
        </Field>
      </Card>

      {
        <>
          <Card title={contactId ? "เพิ่มคู่ค้าให้ลูกค้า LINE นี้" : "เพิ่มคู่ค้า"}>
            <form
              onSubmit={onCreate}
              noValidate
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field
                label="ชื่อคู่ค้า"
                htmlFor="p-name"
                error={errors.displayName}
                required
              >
                <input
                  id="p-name"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm({ ...form, displayName: e.target.value })
                  }
                  maxLength={255}
                  className={inputClass(errors.displayName)}
                />
              </Field>
              <Field
                label="เลขผู้เสียภาษี"
                htmlFor="p-tax"
                error={errors.taxId}
                hint="13 หลัก (ถ้ามี)"
              >
                <input
                  id="p-tax"
                  inputMode="numeric"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  className={inputClass(errors.taxId)}
                />
              </Field>
              <Field label="เบอร์โทร" htmlFor="p-phone" error={errors.phone}>
                <input
                  id="p-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  maxLength={20}
                  className={inputClass(errors.phone)}
                />
              </Field>
              <Field label="หมายเหตุ" htmlFor="p-note">
                <input
                  id="p-note"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  maxLength={2000}
                  className={inputClass()}
                />
              </Field>
              <div className="sm:col-span-2">
                <button type="submit" className={btnPrimary} disabled={busy}>
                  {busy ? "กำลังสร้าง…" : "เพิ่มคู่ค้า"}
                </button>
              </div>
            </form>
          </Card>

          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          {loadError && <Alert tone="error">{loadError}</Alert>}

          <Card
            title={`คู่ค้า (${partners.length})`}
            actions={
              <input
                aria-label="ค้นหาคู่ค้า"
                placeholder="ค้นหาชื่อ / ชื่ออื่น / เลขภาษี"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={`${inputClass()} max-w-xs`}
              />
            }
          >
            {loading && !partners.length ? (
              <p className="text-sm text-zinc-500">กำลังโหลด…</p>
            ) : shown.length === 0 ? (
              <p className="text-sm text-zinc-500">ยังไม่มีคู่ค้า</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {shown.map((p) => (
                  <PartnerRow
                    key={p.id}
                    partner={p}
                    others={partners.filter((x) => x.id !== p.id)}
                    onMessage={setMsg}
                  />
                ))}
              </ul>
            )}
          </Card>
        </>
      }
    </div>
  );
}

function PartnerRow({
  partner: p,
  others,
  onMessage,
}: {
  partner: Partner;
  others: Partner[];
  onMessage: (m: { tone: "error" | "success"; text: string }) => void;
}) {
  const update = usePartnerStore((s) => s.update);
  const remove = usePartnerStore((s) => s.remove);
  const addAlias = usePartnerStore((s) => s.addAlias);
  const removeAlias = usePartnerStore((s) => s.removeAlias);
  const merge = usePartnerStore((s) => s.merge);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    displayName: p.displayName,
    taxId: p.taxId ?? "",
    phone: p.phone ?? "",
    note: p.note ?? "",
  });
  const [errors, setErrors] = useState<ReturnType<typeof checkPartner>>({});
  const [alias, setAlias] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (
    fn: () => Promise<unknown>,
    action: string,
    ok?: string,
  ) => {
    setBusy(true);
    try {
      await fn();
      if (ok) onMessage({ tone: "success", text: ok });
      return true;
    } catch (err) {
      onMessage({ tone: "error", text: partnerErrorMessage(err, action) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    const errs = checkPartner(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const ok = await run(
      () =>
        update(p.id, {
          displayName: form.displayName.trim(),
          taxId: form.taxId.replace(/\D/g, "") || null,
          phone: form.phone.trim() || null,
          note: form.note.trim() || null,
        }),
      "บันทึกคู่ค้า",
      "บันทึกแล้ว",
    );
    if (ok) setEditing(false);
  };

  return (
    <li className="py-3">
      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="ชื่อคู่ค้า"
            error={errors.displayName}
            htmlFor={`e-name-${p.id}`}
          >
            <input
              id={`e-name-${p.id}`}
              value={form.displayName}
              onChange={(e) =>
                setForm({ ...form, displayName: e.target.value })
              }
              className={inputClass(errors.displayName)}
            />
          </Field>
          <Field
            label="เลขผู้เสียภาษี"
            error={errors.taxId}
            htmlFor={`e-tax-${p.id}`}
          >
            <input
              id={`e-tax-${p.id}`}
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
              className={inputClass(errors.taxId)}
            />
          </Field>
          <Field
            label="เบอร์โทร"
            error={errors.phone}
            htmlFor={`e-phone-${p.id}`}
          >
            <input
              id={`e-phone-${p.id}`}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputClass(errors.phone)}
            />
          </Field>
          <Field label="หมายเหตุ" htmlFor={`e-note-${p.id}`}>
            <input
              id={`e-note-${p.id}`}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={inputClass()}
            />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={busy}
              onClick={onSave}
            >
              บันทึก
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setEditing(false)}
            >
              ยกเลิก
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-zinc-900">{p.displayName}</div>
            <div className="text-xs text-zinc-500">
              {[p.taxId && `เลขภาษี ${p.taxId}`, p.phone, `${p._count.bills} บิล`]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {p.note && (
              <div className="mt-0.5 text-xs text-zinc-500">{p.note}</div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className={btnLink}
              onClick={() => setEditing(true)}
            >
              แก้ไข
            </button>
            <button
              type="button"
              className="text-sm text-rose-600 hover:underline"
              disabled={busy}
              onClick={() =>
                window.confirm(
                  `ลบคู่ค้า ${p.displayName}? บิล ${p._count.bills} ใบจะกลับเป็น “ยังไม่ระบุคู่ค้า”`,
                ) &&
                void run(() => remove(p), "ลบคู่ค้า", `ลบ ${p.displayName} แล้ว`)
              }
            >
              ลบ
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-500">ชื่ออื่น:</span>
        {p.aliases.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700"
          >
            {a.rawName}
            <button
              type="button"
              aria-label={`ลบชื่อ ${a.rawName}`}
              className="text-zinc-400 hover:text-rose-500"
              onClick={() => void run(() => removeAlias(p, a.id), "ลบชื่ออื่น")}
            >
              ×
            </button>
          </span>
        ))}
        <input
          aria-label={`เพิ่มชื่ออื่นของ ${p.displayName}`}
          placeholder="+ ชื่ออื่น"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && alias.trim()) {
              e.preventDefault();
              void run(() => addAlias(p, alias.trim()), "เพิ่มชื่ออื่น").then(
                (ok) => ok && setAlias(""),
              );
            }
          }}
          className="w-32 rounded-full border border-dashed border-zinc-300 bg-white px-2 py-0.5 text-xs outline-none focus:border-emerald-500"
        />
      </div>

      {others.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          รวมคู่ค้าที่ซ้ำเข้ามาที่นี่:
          <select
            aria-label={`รวมคู่ค้าเข้า ${p.displayName}`}
            value={mergeFrom}
            onChange={(e) => setMergeFrom(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs"
          >
            <option value="">— เลือกคู่ค้า —</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.displayName} ({o._count.bills} บิล)
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`${btnDanger} h-7 px-2 text-xs`}
            disabled={!mergeFrom || busy}
            onClick={() => {
              const from = others.find((o) => o.id === mergeFrom);
              if (
                from &&
                window.confirm(
                  `รวม ${from.displayName} เข้ากับ ${p.displayName}? บิลและชื่ออื่นทั้งหมดจะย้ายมา และ ${from.displayName} จะถูกลบ`,
                )
              ) {
                void run(
                  () => merge(p, from.id),
                  "รวมคู่ค้า",
                  `รวม ${from.displayName} เข้ากับ ${p.displayName} แล้ว`,
                ).then(() => setMergeFrom(""));
              }
            }}
          >
            รวม
          </button>
        </div>
      )}
    </li>
  );
}
