import "server-only";
import { integrationConfig } from "./config";
import type { Channel } from "../integration-values";
import { createWebhookHandlers } from "../webhook-handler";
import { storeInbound, processIntegrationEvent } from "../data/integrations";
import {recordWhatsAppStatuses} from '../data/quotation-statuses';
export function webhookHandlers(channel:Channel){return createWebhookHandlers(channel,{
  config:()=>integrationConfig(channel),store:storeInbound,process:processIntegrationEvent,
  statuses:channel==='whatsapp'?recordWhatsAppStatuses:undefined,
});}
