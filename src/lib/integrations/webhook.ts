import "server-only";
import { integrationConfig } from "./config";
import type { Channel } from "../integration-values";
import { createWebhookHandlers } from "../webhook-handler";
import { storeInbound, processIntegrationEvent } from "../data/integrations";
export function webhookHandlers(channel:Channel){return createWebhookHandlers(channel,{
  config:()=>integrationConfig(channel),store:storeInbound,process:processIntegrationEvent,
});}
