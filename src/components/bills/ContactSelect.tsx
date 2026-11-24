"use client";

import { useEffect } from "react";
import { usePartnerStore } from "@/stores/partnerStore";
import { inputClass } from "./ui";

/** dropdown เลือกลูกค้า LINE (contactId) — รายชื่อมาจากห้องแชตทั้งหมด */
export function ContactSelect({
  id,
  value,
  onChange,
  error,
  disabled,
  allowAll,
  emptyLabel,
}: {
  id?: string;
  value: string;
  onChange: (contactId: string) => void;
  error?: string;
  disabled?: boolean;
  /** มีตัวเลือก "ทุกลูกค้า" (ค่า "") */
  allowAll?: boolean;
  /** ข้อความของตัวเลือกค่าว่าง (แทน "ทุกลูกค้า" / "เลือกลูกค้า LINE") */
  emptyLabel?: string;
}) {
  const contacts = usePartnerStore((s) => s.contacts);
  const loaded = usePartnerStore((s) => s.contactsLoaded);
  const loadError = usePartnerStore((s) => s.contactsError);
  const loadContacts = usePartnerStore((s) => s.loadContacts);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  return (
    <>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !loaded}
        aria-invalid={!!error}
        className={inputClass(error)}
      >
        <option value="">{!loaded ? "กำลังโหลด…" : (emptyLabel ?? (allowAll ? "ทุกลูกค้า" : "— เลือกลูกค้า LINE —"))}</option>
        {contacts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.displayName ?? c.lineUserId}
          </option>
        ))}
      </select>
      {loadError && <p className="mt-1 text-xs text-rose-600">{loadError}</p>}
    </>
  );
}
