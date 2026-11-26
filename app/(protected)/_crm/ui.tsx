import Link from "next/link";
import type { SearchParams } from "./types";

export function PageHeading({ title, subtitle, createHref }: { title: string; subtitle?: string; createHref?: string }) {
  return <header className="page-heading"><div><p className="eyebrow">PROSPERA / WORKSPACE</p><h1>{title}</h1>{subtitle && <p className="muted">{subtitle}</p>}</div>
    {createHref && <Link className="button-link" href={createHref}>Add {title === "Companies" ? "company" : title === "Contacts" ? "contact" : "lead"}</Link>}
  </header>;
}
export function LoadingRecords() { return <p className="loading" role="status">Loading records…</p>; }
export async function listQuery(params: SearchParams) {
  const query = await params;
  const single = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const parsedPage = Number(single("page"));
  return { page: Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 1_000_000 ? parsedPage : 1,
    search: single("search").slice(0, 500), source: single("source"), status: single("status") };
}
export function Pagination({ base, page, pageSize, total, filters = {} }: {
  base: string; page: number; pageSize: number; total: number; filters?: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (next: number) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)));
    query.set("page", String(next)); return `${base}?${query}`;
  };
  return <nav className="pagination" aria-label="Pagination"><span>{total} records · Page {page} of {pages}</span><div>
    {page > 1 && <><Link href={href(1)}>First</Link><Link href={href(page - 1)}>Previous</Link></>}
    {page < pages && <Link href={href(page + 1)}>Next</Link>}
  </div></nav>;
}
export function SearchForm({ search, children }: { search: string; children?: React.ReactNode }) {
  return <form method="get" className="list-filters"><div className="field"><label htmlFor="record-search">Search</label>
    <input id="record-search" name="search" defaultValue={search} type="search" /></div>{children}<button type="submit">Apply</button></form>;
}
export function DateLabel({ value }: { value: Date }) {
  return <time dateTime={value.toISOString()}>{value.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })}</time>;
}
