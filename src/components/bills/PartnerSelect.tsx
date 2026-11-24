"use client";

import { useEffect } from "react";
import { ALL_PARTNERS, usePartnerStore } from "@/stores/partnerStore";
import { inputClass } from "./ui";

/** dropdown เลือกคู่ค้าจากตาราง partners (GET /api/partners) — ค่าว่าง = ไม่ระบุ */
export function PartnerSelect({
  id,
  value,
  onChange,
  error,
  disabled,
  emptyLabel = "— ไม่ระบุ —",
}: {
  id?: string;
  value: string;
  onChange: (partnerId: string) => void;
  error?: string;
  disabled?: boolean;
  emptyLabel?: string;
}) {
  const partners = usePartnerStore((s) => s.byContact[ALL_PARTNERS]);
  const loading = usePartnerStore((s) => !!s.loading[ALL_PARTNERS]);
  const loadError = usePartnerStore((s) => s.error[ALL_PARTNERS]);
  const loadPartners = usePartnerStore((s) => s.loadPartners);

  useEffect(() => {
    void loadPartners(ALL_PARTNERS);
  }, [loadPartners]);

  return (
    <>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || (!partners && loading)}
        aria-invalid={!!error}
        className={inputClass(error)}
      >
        <option value="">{!partners && loading ? "กำลังโหลดคู่ค้า…" : emptyLabel}</option>
        {partners?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
            {p.taxId ? ` · ${p.taxId}` : ""}
          </option>
        ))}
      </select>
      {loadError && <p className="mt-1 text-xs text-rose-600">{loadError}</p>}
    </>
  );
}
