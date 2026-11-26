"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNav() {
  const pathname = usePathname();
  return <nav aria-label="Workspace" className="workspace-nav">
    {[["/", "Dashboard"], ["/analytics", "Analytics"], ["/analyst", "AI Analyst"], ["/integrations", "Integrations"], ["/activities", "Activities"], ["/leads", "Leads"], ["/pipeline", "Pipeline"], ["/deals", "Deals"], ["/quotations", "Quotations"], ["/orders", "Orders"], ["/payments", "Payments"], ["/expenses", "Expenses"], ["/contacts", "Contacts"], ["/companies", "Companies"]].map(([href, label]) => {
      const active = href === "/" ? pathname === href : pathname.startsWith(`${href}/`) || pathname === href;
      return <Link key={href} href={href} aria-current={active ? "page" : undefined}>{label}</Link>;
    })}
  </nav>;
}
