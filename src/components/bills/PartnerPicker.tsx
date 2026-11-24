"use client";

import { useEffect, useState } from "react";
import { partnerErrorMessage, usePartnerStore } from "@/stores/partnerStore";
import type { PartnerRef, PartnerSuggestion } from "@/types/bill";
import { btnLink, btnSecondary, inputClass } from "./ui";

/**
 * เลือกคู่ค้าของบิล — ระบบแค่เสนอตัวเลือก ผู้ใช้ต้องกดเลือกเอง (ไม่เลือก/ไม่สร้างให้อัตโนมัติ)
 * ตัวเลือก: ชื่อใกล้เคียงจาก /partners/suggest, รายชื่อทั้งหมด, หรือสร้างคู่ค้าใหม่
 */
export function PartnerPicker({
  contactId,
  rawName,
  rawTaxId,
  value,
  onChange,
}: {
  contactId: string;
  rawName: string;
  rawTaxId: string;
  value: PartnerRef | null;
  onChange: (partner: PartnerRef | null) => void;
}) {
  // contactId ว่าง = บิลจากหน้าเว็บ → เลือกได้จากคู่ค้าทั้งหมด
  const partners = usePartnerStore((s) => s.byContact[contactId]);
  const loadPartners = usePartnerStore((s) => s.loadPartners);
  const suggest = usePartnerStore((s) => s.suggest);
  const createPartner = usePartnerStore((s) => s.create);

  const [suggestion, setSuggestion] = useState<PartnerSuggestion | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadPartners(contactId);
  }, [contactId, loadPartners]);

  // หาตัวเลือกเมื่อชื่อ/เลขภาษีตามบิลเปลี่ยน (หน่วง 400ms)
  useEffect(() => {
    if (!rawName.trim() && rawTaxId.replace(/\D/g, "").length !== 13) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await suggest(contactId, rawName, rawTaxId);
      if (!cancelled) setSuggestion(res);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [contactId, rawName, rawTaxId, suggest, partners]);


  const pick = (id: string) => {
    const p = partners?.find((x) => x.id === id);
    if (p) onChange({ id: p.id, displayName: p.displayName, taxId: p.taxId });
  };

  const onCreate = async () => {
    const name = newName.trim();
    if (!name) return setError("กรุณาตั้งชื่อคู่ค้า");
    setBusy(true);
    setError(null);
    try {
      const taxDigits = rawTaxId.replace(/\D/g, "");
      const p = await createPartner({
        contactId: contactId || null,
        displayName: name,
        taxId: taxDigits.length === 13 ? taxDigits : null,
        aliasFrom: rawName.trim() || null,
      });
      onChange({ id: p.id, displayName: p.displayName, taxId: p.taxId });
      setCreating(false);
      setNewName("");
    } catch (err) {
      setError(partnerErrorMessage(err, "สร้างคู่ค้า"));
    } finally {
      setBusy(false);
    }
  };

  const matchedId = suggestion?.matched?.partnerId;
  const showSuggestions = !!rawName.trim() || rawTaxId.replace(/\D/g, "").length === 13;

  return (
    <div className="space-y-3">
      {value ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div>
            <div className="text-sm font-semibold text-emerald-900">{value.displayName}</div>
            {value.taxId && <div className="text-xs text-emerald-700">เลขผู้เสียภาษี {value.taxId}</div>}
          </div>
          <button type="button" className={btnLink} onClick={() => onChange(null)}>
            ยกเลิกการเลือก
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ยังไม่ระบุคู่ค้า — บิลนี้จะยังไม่ถูกนับในยอดสรุปตามคู่ค้า
        </div>
      )}

      {showSuggestions && suggestion && suggestion.candidates.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-500">
            ชื่อใกล้เคียงกับ &quot;{suggestion.name || rawTaxId}&quot;
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestion.candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange({ id: c.id, displayName: c.displayName, taxId: c.taxId })}
                className={`rounded-full border px-3 py-1 text-sm ${
                  value?.id === c.id
                    ? "border-emerald-500 bg-emerald-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-400"
                }`}
              >
                {c.displayName}
                {c.id === matchedId ? (
                  <span className="ml-1 text-xs opacity-80">
                    ({suggestion.matched?.reason === "tax_id" ? "เลขภาษีตรง" : "เคยยืนยันชื่อนี้"})
                  </span>
                ) : (
                  <span className="ml-1 text-xs opacity-60">{Math.round(c.score * 100)}%</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <select
          aria-label="เลือกจากรายชื่อคู่ค้า"
          value={value?.id ?? ""}
          onChange={(e) => (e.target.value ? pick(e.target.value) : onChange(null))}
          className={inputClass()}
        >
          <option value="">{partners ? `— เลือกจากรายชื่อ (${partners.length}) —` : "กำลังโหลดคู่ค้า…"}</option>
          {partners?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
              {p.taxId ? ` · ${p.taxId}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            setCreating((v) => !v);
            setNewName((n) => n || rawName.trim());
            setError(null);
          }}
        >
          + สร้างคู่ค้าใหม่
        </button>
      </div>

      {creating && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <label htmlFor="new-partner-name" className="mb-1 block text-sm font-medium text-zinc-700">
            ชื่อคู่ค้าใหม่
          </label>
          <div className="flex gap-2">
            <input
              id="new-partner-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={255}
              placeholder="เช่น ร้านเอ"
              className={inputClass(error ?? undefined)}
            />
            <button type="button" className={btnSecondary} disabled={busy} onClick={onCreate}>
              {busy ? "กำลังสร้าง…" : "สร้างและเลือก"}
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            ระบบจะจำชื่อตามบิล{rawName.trim() ? ` "${rawName.trim()}"` : ""} เป็นชื่ออื่นของคู่ค้านี้ด้วย
          </p>
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
