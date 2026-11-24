import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/nav/AppShell";
import { BillForm } from "@/components/bills/BillForm";

export const metadata: Metadata = {
  title: "แก้ไขบิล · Web chat",
};

type Params = Promise<{ id: string }>;

// อ่าน params ใน <Suspense> (cacheComponents: ส่วนอื่นของหน้า prerender ได้)
export default function EditBillPage({ params }: { params: Params }) {
  return (
    <AuthGuard>
      <AppShell>
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <Link href="/bills" className="text-sm text-zinc-500 hover:text-zinc-800">
            ← รายการบิล
          </Link>
          <h1 className="mb-5 mt-1 text-xl font-semibold text-zinc-900">แก้ไขบิล</h1>
          <Suspense fallback={<p className="text-sm text-zinc-500">กำลังโหลดบิล…</p>}>
            <BillFormWithParams params={params} />
          </Suspense>
        </main>
      </AppShell>
    </AuthGuard>
  );
}

async function BillFormWithParams({ params }: { params: Params }) {
  const { id } = await params;
  return <BillForm billId={id} />;
}
