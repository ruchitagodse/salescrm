import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, type ActivityTargetType } from "@/lib/activity-values";
import type { listActivities } from "@/lib/data";
import { activityStatusAction } from "./activity-actions";
import { ActivityStatusButton } from "./activity-form";

export const targetHref = (type: ActivityTargetType, id: string) => `/${type === "contact" ? "contacts" : type === "lead" ? "leads" : "deals"}/${id}`;
export function ActivityTime({ value }: { value: Date }) {
  return <time dateTime={value.toISOString()}>{value.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST</time>;
}
export function ActivityTable({ items }: { items: Awaited<ReturnType<typeof listActivities>>["items"] }) {
  return <div className="table-scroll" role="region" aria-label="Activities" tabIndex={0}><table><caption className="sr-only">Activities and follow-ups, India time</caption>
    <thead><tr><th scope="col">Activity</th><th scope="col">Type</th><th scope="col">Linked record</th><th scope="col">Due (India)</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
    <tbody>{items.map((row) => <tr key={row.id}><td><Link href={`/activities/${row.id}`}>{row.title}</Link></td><td>{ACTIVITY_TYPE_LABELS[row.type]}</td>
      <td><Link href={targetHref(row.targetType, row.targetId)}>{row.targetLabel}</Link> <small>({row.targetType})</small></td>
      <td><ActivityTime value={row.dueAt} /></td><td><span className={`badge ${row.status}`}>{row.status}</span></td>
      <td><ActivityStatusButton title={row.title} reopen={row.status !== "planned"} action={activityStatusAction.bind(null, row.id, row.status === "planned" ? "completed" : "planned")} /></td></tr>)}</tbody>
  </table></div>;
}
