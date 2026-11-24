import type { Metadata } from "next";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/nav/AppShell";
import { BillsList } from "@/components/bills/BillsList";
import { ExportBillsButton } from "@/components/bills/ExportBillsButton";

export const metadata: Metadata = {
  title: "บิล · Web chat",
};

export default function BillsPage() {
  return (
    <AuthGuard>
      <AppShell>
        <main className="mx-auto w-full max-w-6xl px-4 py-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold text-zinc-900">
              บิลซื้อ / บิลขาย
            </h1>
            <div className="flex gap-2">
              <ExportBillsButton />
              <Link
                href="/bills/new"
                className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold leading-10 text-white hover:bg-emerald-700"
              >
                + เพิ่มบิล
              </Link>
            </div>
          </div>
          <BillsList />
        </main>
      </AppShell>
    </AuthGuard>
  );
}
