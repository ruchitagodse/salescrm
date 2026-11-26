import { FinancialListPage } from "../_crm/finance-pages";
import type { SearchParams } from "../_crm/types";
export default function Page(props: { searchParams: SearchParams }) { return <FinancialListPage {...props} kind="quotations" />; }
