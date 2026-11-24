import { Suspense } from "react";
import { requireUser } from "@/lib/auth";

async function Dashboard({ searchParams }: { searchParams: Promise<{ logout?: string }> }) {
  const user = await requireUser();
  const { logout } = await searchParams;
  return (
    <section className="panel">
      <p className="eyebrow">YOUR WORKSPACE</p>
      <h1>Dashboard</h1>
      <p>Signed in as <strong>{user.email}</strong></p>
      {logout === "failed" && <p className="error" role="alert">Unable to sign out. Please try again.</p>}
      <p className="muted">Your sales workspace will take shape here in the next phases.</p>
    </section>
  );
}

export default function DashboardPage(props: { searchParams: Promise<{ logout?: string }> }) {
  return <Suspense fallback={<p role="status">Loading dashboard…</p>}><Dashboard {...props} /></Suspense>;
}
