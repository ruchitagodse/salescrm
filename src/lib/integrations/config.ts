import "server-only";
import { CHANNELS, type Channel } from "../integration-values";
const names = {
  meta_ads: ["META_ADS_APP_SECRET","META_ADS_VERIFY_TOKEN","META_ADS_PAGE_ID","META_ADS_PAGE_ACCESS_TOKEN"],
  instagram: ["INSTAGRAM_APP_SECRET","INSTAGRAM_VERIFY_TOKEN","INSTAGRAM_ACCOUNT_ID","INSTAGRAM_ACCESS_TOKEN"],
  whatsapp: ["WHATSAPP_APP_SECRET","WHATSAPP_VERIFY_TOKEN","WHATSAPP_PHONE_NUMBER_ID"],
} as const;
export function integrationStatus() {
  return CHANNELS.map(channel=>({channel,variables:[...names[channel],...(channel==='whatsapp'?[]:['META_GRAPH_API_VERSION'])].map(name=>({name,present:Boolean(process.env[name])}))}));
}
export function integrationConfig(channel: Channel) {
  const [secret,verifyToken,accountId,accessToken]=names[channel].map(name=>process.env[name]);
  const version=process.env.META_GRAPH_API_VERSION;
  if(!secret || !verifyToken || !accountId || !/^\d+$/.test(accountId) || (channel!=='whatsapp' && (!accessToken || !version || !/^v\d{1,3}\.\d+$/.test(version)))) throw new Error("Integration unavailable");
  return {secret,verifyToken,accountId,accessToken:accessToken ?? '',version:version ?? ''};
}
