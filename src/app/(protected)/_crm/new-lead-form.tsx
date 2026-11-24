"use client";

import { useState } from "react";
import { RecordForm } from "./form";
import { companyFields, contactFields } from "./fields";
import { leadFields } from "./lead-fields";
import { addEnquiry } from "./lead-actions";
import { saveCompany } from "./record-actions";
import type { Option } from "./types";

export function NewLeadForm({ companies }: { companies: Option[] }) {
  const [options, setOptions] = useState(companies);
  const [company, setCompany] = useState("");
  const fields = [
    ...contactFields(options).filter((field) => field.name !== "notes"),
    ...leadFields(),
  ];
  return <>
    <details className="quick-create"><summary>Create a new company (optional)</summary>
      <p>Create it first; it will be selected in the enquiry below. The company is saved separately from the enquiry.</p>
      <RecordForm action={saveCompany.bind(null, null)} fields={[companyFields[0]]} kind="companies" create
        onCreated={(option) => { setOptions((previous) => [option, ...previous.filter((item) => item.value !== option.value)]); setCompany(option.value); }} />
    </details>
    <p className="muted">A matching phone or email reuses the existing contact. Its known details are kept.</p>
    <RecordForm action={addEnquiry} fields={fields} kind="leads" create companyValue={company} onCompanyChange={setCompany} />
  </>;
}
