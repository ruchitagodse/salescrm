import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { activitiesReady, getActivity, listActivities } from "@/lib/data";
import { ACTIVITY_TARGETS, ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, ACTIVITY_VIEWS, type ActivityTargetType } from "@/lib/activity-values";
import { indiaLocalInput } from "@/lib/activity-time";
import { entityIdSchema } from "@/lib/validation";
import { ActivityForm } from "./activity-form";
import { activityOptions } from "./activity-options";
import { ActivityTable, ActivityTime, targetHref } from "./activity-ui";
import { deleteActivityAction, saveActivityAction } from "./activity-actions";
import { DeleteForm } from "./form";
import { fieldValues, optionalRecord } from "./queries";
import { LoadingRecords, PageHeading, Pagination, SearchForm } from "./ui";
import type { DetailParams, SearchParams } from "./types";

const unavailable = () => <section className="panel"><h1>Activities unavailable</h1><p>Contact the owner to finish activity setup.</p></section>;
const one = (query: Record<string, string | string[] | undefined>, name: string) => typeof query[name] === "string" ? query[name] as string : "";
async function ActivityList({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  if (!(await activitiesReady())) return unavailable();
  const query = await searchParams;
  const view = ACTIVITY_VIEWS.find((v) => v === one(query, "view")) ?? "today";
  const type = ACTIVITY_TYPES.find((v) => v === one(query, "type"));
  const search = one(query, "search").slice(0, 500);
  const pageValue = Number(one(query, "page"));
  const page = Number.isInteger(pageValue) && pageValue >= 1 && pageValue <= 1_000_000 ? pageValue : 1;
  const selectedType = ACTIVITY_TARGETS.find((v) => v === one(query, "targetType"));
  const selectedId = entityIdSchema.safeParse(one(query, "targetId"));
  const target = selectedType && selectedId.success ? { targetType: selectedType, targetId: selectedId.data } : {};
  const result = await listActivities({ view, type, search, page, ...target });
  const filters = { view, type: type ?? "", search, targetType: target.targetType ?? "", targetId: target.targetId ?? "" };
  return <><PageHeading title="Activities & follow-ups" subtitle="Your next actions, shown in India time." createHref="/activities/new" />
    <nav className="workspace-nav activity-views" aria-label="Activity views">{ACTIVITY_VIEWS.map((value) => <Link key={value} href={`/activities?${new URLSearchParams({ ...filters, view: value })}`} aria-current={view === value ? "page" : undefined}>{value}</Link>)}</nav>
    <section className="panel"><p className="muted">Today includes planned activities due on the India calendar day; Overdue includes every planned activity whose due time has passed. These views can overlap.</p>
      {target.targetId && <p>Showing activities linked to one {target.targetType}. <Link href="/activities?view=all">Show all records</Link></p>}
      <SearchForm search={search}><input type="hidden" name="view" value={view} />
        {target.targetId && <><input type="hidden" name="targetType" value={target.targetType} /><input type="hidden" name="targetId" value={target.targetId} /></>}
        <div className="field"><label htmlFor="activity-type-filter">Type</label><select id="activity-type-filter" name="type" defaultValue={type ?? ""}><option value="">All types</option>{ACTIVITY_TYPES.map((value) => <option key={value} value={value}>{ACTIVITY_TYPE_LABELS[value]}</option>)}</select></div>
      </SearchForm>
      {result.items.length ? <ActivityTable items={result.items} /> : <p className="empty-state">No activities in this view. <Link href="/activities/new">Add an activity</Link> or change the filters.</p>}
      <Pagination base="/activities" {...result} filters={filters} />
    </section></>;
}
async function ActivityCreate({ searchParams }: { searchParams: SearchParams }) {
  await requireUser();
  if (!(await activitiesReady())) return unavailable();
  const query = await searchParams;
  const options = await activityOptions();
  const type = ACTIVITY_TARGETS.find((v) => v === one(query, "targetType")) ?? "contact";
  const id = one(query, "targetId");
  const targetId = options[type].some((option) => option.value === id) ? id : "";
  return <><PageHeading title="New activity" /><section className="panel"><Link href="/activities">Back to activities</Link>
    <ActivityForm action={saveActivityAction.bind(null, null)} options={options} values={{ targetType: type, targetId }} create />
  </section></>;
}
async function ActivityDetail({ params }: { params: DetailParams }) {
  await requireUser();
  if (!(await activitiesReady())) return unavailable();
  const { id } = await params;
  if (!entityIdSchema.safeParse(id).success) notFound();
  const row = await optionalRecord(() => getActivity(id));
  if (!row) notFound();
  const options = await activityOptions();
  if (!options[row.targetType].some((option) => option.value === row.targetId)) options[row.targetType].push({ value: row.targetId, label: `${row.targetLabel} (unavailable)` });
  return <><PageHeading title={row.title} /><section className="panel"><Link href="/activities">Back to activities</Link>
    <p>Linked {row.targetType}: <Link href={targetHref(row.targetType, row.targetId)}>{row.targetLabel}</Link></p>
    <p>Due <ActivityTime value={row.dueAt} /> · <span className={`badge ${row.status}`}>{row.status}</span></p>
    {row.completedAt && <p>Completed <ActivityTime value={row.completedAt} /></p>}
    <ActivityForm action={saveActivityAction.bind(null, id)} options={options} values={{ ...fieldValues(row), dueAtLocal: indiaLocalInput(row.dueAt) }} />
    <DeleteForm action={deleteActivityAction.bind(null, id)} label="activity" />
  </section></>;
}
export async function RelatedActivities({ type, id }: { type: ActivityTargetType; id: string }) {
  await requireUser();
  if (!(await activitiesReady())) return null;
  const result = await listActivities({ targetType: type, targetId: id, pageSize: 5, view: "all" });
  const query = new URLSearchParams({ targetType: type, targetId: id });
  return <section className="related-records"><h2>Activities & follow-ups</h2><p><Link href={`/activities/new?${query}`}>Add activity</Link> · <Link href={`/activities?${query}&view=all`}>View all ({result.total})</Link></p>
    {result.items.length ? <ActivityTable items={result.items} /> : <p className="muted">No linked activities yet.</p>}</section>;
}
export function ActivityListPage(props: { searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><ActivityList {...props} /></Suspense>; }
export function ActivityNewPage(props: { searchParams: SearchParams }) { return <Suspense fallback={<LoadingRecords />}><ActivityCreate {...props} /></Suspense>; }
export function ActivityDetailPage(props: { params: DetailParams }) { return <Suspense fallback={<LoadingRecords />}><ActivityDetail {...props} /></Suspense>; }
