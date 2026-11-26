import { MoneyDetailPage } from "../../_crm/finance-pages";
import type { DetailParams } from "../../_crm/types";
export default function Page(props: { params: DetailParams }) { return <MoneyDetailPage {...props} kind="expenses" />; }
