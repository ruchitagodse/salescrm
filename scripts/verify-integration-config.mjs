import { config } from 'dotenv';
config({path:'.env.local',quiet:true});
const groups={
 meta_ads:['META_ADS_APP_SECRET','META_ADS_VERIFY_TOKEN','META_ADS_PAGE_ID','META_ADS_PAGE_ACCESS_TOKEN','META_GRAPH_API_VERSION'],
 instagram:['INSTAGRAM_APP_SECRET','INSTAGRAM_VERIFY_TOKEN','INSTAGRAM_ACCOUNT_ID','INSTAGRAM_ACCESS_TOKEN','META_GRAPH_API_VERSION'],
 whatsapp:['WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_PHONE_NUMBER_ID'],
};
console.log(JSON.stringify({configurationPresence:Object.entries(groups).map(([channel,names])=>({channel,variables:names.map(name=>({name,present:Boolean(process.env[name])}))})),liveProviderVerification:false}));
