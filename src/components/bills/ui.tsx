import type { ReactNode } from "react";

// ชิ้นส่วนฟอร์มที่ใช้ร่วมกันในหน้าบิล/คู่ค้า (สไตล์เดียวกับ CreateAdminForm)

export const inputBase =
  "w-full rounded-lg border bg-zinc-50 px-3 py-2 text-[15px] outline-none focus:border-emerald-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

export const inputClass = (error?: string) => `${inputBase} ${error ? "border-rose-400" : "border-zinc-200"}`;

export const btnPrimary =
  "h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300";
export const btnSecondary =
  "h-10 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "h-10 rounded-lg border border-rose-200 bg-white px-4 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50";
export const btnLink = "text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Card({ title, actions, children }: { title?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-zinc-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  const cls = {
    error: "border-rose-200 bg-rose-50 text-rose-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-zinc-200 bg-zinc-50 text-zinc-700",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

/** "1250.5" → "1,250.50" */
export function formatMoney(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "-";
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
}

/** "2026-11-24..." → "24 พ.ย. 2569" */
export function formatDate(v: string | null | undefined): string {
  if (!v) return "-";
  const d = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
