"use client";

// Root boundary also catches failures in the protected layout (profile setup).
export default function WorkspaceError({ retry }: { retry: () => void }) {
  return (
    <main className="app-content panel">
      <h1>Unable to open your workspace</h1>
      <p>Please try again. If the problem continues, contact the owner.</p>
      <button onClick={retry}>Try again</button>
    </main>
  );
}
