import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { ensureCurrentProfile } from "@/lib/profiles";
import { logout } from "./actions";
import { WorkspaceNav } from "./_crm/nav";
import "./crm.scss";

async function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  await requireUser();
  await ensureCurrentProfile();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-content">Skip to content</a>
      <header className="app-header">
        <span className="brand">OS <span>PROSPERA</span></span>
        <form action={logout}><button className="secondary" type="submit">Sign out</button></form>
      </header>
      <WorkspaceNav />
      <main className="app-content" id="workspace-content">{children}</main>
    </div>
  );
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<main className="loading" role="status">Opening your workspace…</main>}>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </Suspense>
  );
}
