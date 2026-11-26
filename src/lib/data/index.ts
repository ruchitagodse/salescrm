import "server-only";

export { DataError } from "./shared";
export { createCompany, updateCompany, softDeleteCompany, getCompany, listCompanies } from "./companies";
export { createContact, updateContact, softDeleteContact, getContact, listContacts } from "./contacts";
export { createLead, updateLead, softDeleteLead, getLead, listLeads, createLeadWithContact } from "./leads";
export { pipelineReady, convertLeadToDeal, findDealForLead, getDeal, updateDeal, softDeleteDeal, listDeals } from "./deals";
export { activitiesReady, createActivity, updateActivity, softDeleteActivity, getActivity, listActivities } from "./activities";
export { financeReady, saveQuotation, changeQuotationStatus, softDeleteQuotation, convertQuotationToOrder, getQuotation, getOrder, recordPayment, recordExpense, voidFinancialRecord, getPayment, getExpense, listQuotations, listOrders, listPayments, listExpenses } from "./finance";
export { getAnalytics } from "./analytics";
