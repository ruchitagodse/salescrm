import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-screen">
      <section className="panel login-panel" aria-labelledby="login-title">
        <p className="eyebrow">PROSPERA DIGITAL SOLUTIONS</p>
        <h1 id="login-title">Sign in to OS</h1>
        <p className="muted">Your business, in one workspace.</p>
        <LoginForm />
        <p className="muted invite-note">Access is invite-only. Contact the owner for an account.</p>
      </section>
    </main>
  );
}
