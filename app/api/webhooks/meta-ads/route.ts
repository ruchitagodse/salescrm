import { webhookHandlers } from "@/lib/integrations/webhook";
const handlers = webhookHandlers("meta_ads");
export async function GET(request: Request) { return handlers.GET(request); }
export async function POST(request: Request) { return handlers.POST(request); }
