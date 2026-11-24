import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/nav/AppShell";
import { NewBillForm } from "@/components/bills/NewBillForm";

export const metadata: Metadata = {
  title: "เพิ่มบิล · Web chat",
};

type SearchParams = Promise<{ partnerId?: string | string[] }>;

// อ่าน searchParams ใน <Suspense> (cacheComponents: ส่วนอื่นของหน้า prerender ได้)
export default function NewBillPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <AuthGuard>
      <AppShell>
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <Link href="/bills" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← รายการบิล
          </Link>
          <h1 className="mb-5 mt-1 text-xl font-semibold text-zinc-900">เพิ่มบิล</h1>
          <Suspense fallback={<p className="text-sm text-zinc-500">กำลังโหลด…</p>}>
            <NewBillFormWithParams searchParams={searchParams} />
          </Suspense>
        </main>
      </AppShell>
    </AuthGuard>
  );
}

async function NewBillFormWithParams({ searchParams }: { searchParams: SearchParams }) {
  const { partnerId } = await searchParams; // /bills/new?partnerId=... = เลือกคู่ค้าไว้ก่อน
  return <NewBillForm initialPartnerId={typeof partnerId === "string" ? partnerId : undefined} />;
}
