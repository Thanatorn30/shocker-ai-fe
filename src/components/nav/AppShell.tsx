"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// แถบเมนูด้านบน (tab) ใช้ร่วมกันทุกหน้าที่ต้อง login

const TABS = [
  { href: "/", label: "แชต", match: (p: string) => p === "/" },
  { href: "/bills", label: "บิล", match: (p: string) => p === "/bills" || p.startsWith("/bills/") },
  // { href: "/partners", label: "คู่ค้า", match: (p: string) => p.startsWith("/partners") },
  // { href: "/admins/new", label: "แอดมิน", match: (p: string) => p.startsWith("/admins") },
] as const;

export function AppTabs() {
  return (
    <header className="shrink-0 border-b border-zinc-200 bg-white">
      <div className="flex h-12 items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="หน้าแรก">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-sm font-bold text-white">W</span>
        </Link>
        <nav aria-label="เมนูหลัก" className="-mb-px flex h-full min-w-0 items-stretch gap-1 overflow-x-auto">
          {/* usePathname() ของหน้าที่มี [id] รู้ค่าตอนเปิดหน้าเท่านั้น → อ่านใน Suspense (cacheComponents)
              ระหว่างรอแสดง tab แบบยังไม่ไฮไลต์ */}
          <Suspense fallback={<TabLinks pathname={null} />}>
            <ActiveTabLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

function ActiveTabLinks() {
  return <TabLinks pathname={usePathname() ?? "/"} />;
}

function TabLinks({ pathname }: { pathname: string | null }) {
  return TABS.map((tab) => {
    const active = pathname !== null && tab.match(pathname);
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition ${
          active
            ? "border-emerald-600 text-emerald-700"
            : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800"
        }`}
      >
        {tab.label}
      </Link>
    );
  });
}

/** โครงหน้า: tab ด้านบน + เนื้อหาเต็มความสูงที่เหลือ (เลื่อนเฉพาะส่วนเนื้อหา) */
export function AppShell({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <div className="flex h-dvh flex-col">
      <AppTabs />
      <div className={`min-h-0 flex-1 ${scroll ? "overflow-y-auto" : "overflow-hidden"}`}>{children}</div>
    </div>
  );
}
