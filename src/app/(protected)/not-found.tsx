import Link from "next/link";
export default function RecordNotFound() {
  return <section className="panel"><h1>Record unavailable</h1><p>It may have been deleted or the link is invalid.</p><Link href="/">Return to dashboard</Link></section>;
}
