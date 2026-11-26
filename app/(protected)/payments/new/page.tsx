import { MoneyNewPage } from "../../_crm/finance-pages";
import type { SearchParams } from "../../_crm/types";
export default function Page(props: { searchParams: SearchParams }) { return <MoneyNewPage {...props} kind="payments" />; }
