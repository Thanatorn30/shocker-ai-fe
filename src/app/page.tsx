import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/nav/AppShell";
import { ChatApp } from "@/components/chat/ChatApp";

export default function Home() {
  return (
    <AuthGuard>
      <AppShell scroll={false}>
        <ChatApp />
      </AppShell>
    </AuthGuard>
  );
}
