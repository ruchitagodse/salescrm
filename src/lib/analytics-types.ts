export type CashMonth = { month: string; receipts: string; expenses: string; netCash: string };
export type AnalyticsRaw = {
  asOf: string;
  receipts: string; receiptCount: string; expenses: string; expenseCount: string;
  bookedValue: string; orderCount: string; leadCount: string; convertedCount: string; dealCount: string;
  sources: { key: string; count: string }[]; leadStatuses: { key: string; count: string }[];
  dealOutcomes: { key: string; count: string }[]; dealStages: { key: string; count: string }[];
  monthly: { month: string; receipts: string; expenses: string }[];
  outstanding: string; outstandingOrders: string;
  balances: { id: string; number: string; customerName: string; title: string; total: string; paid: string; balance: string }[];
  openPipeline: string; openDeals: string; unknownValues: string;
  pipeline: { key: string; count: string; value: string; unknown: string }[];
};
