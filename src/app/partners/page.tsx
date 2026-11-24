import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/nav/AppShell";
import { PartnersManager } from "@/components/partners/PartnersManager";

export const metadata: Metadata = {
  title: "คู่ค้า · Web chat",
};

export default function PartnersPage() {
  return (
    <AuthGuard>
      <AppShell>
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
          <h1 className="mb-5 text-xl font-semibold text-zinc-900">คู่ค้า</h1>
          <PartnersManager />
        </main>
      </AppShell>
    </AuthGuard>
  );
}
