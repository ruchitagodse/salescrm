import 'server-only';
import nodemailer from 'nodemailer';
import {z} from 'zod';
export function deliveryConfiguration(){return {email:Boolean(process.env.SMTP_HOST&&process.env.SMTP_PORT&&process.env.SMTP_USER&&process.env.SMTP_PASSWORD),whatsapp:Boolean(process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID&&process.env.META_GRAPH_API_VERSION)};}
export class DeliveryError extends Error{constructor(public ambiguous:boolean,public code:string){super('Provider submission unavailable');}}
export async function submitEmail(input:{id:string;recipient:string;reference:string;pdf:Buffer}){
 const host=process.env.SMTP_HOST,user=process.env.SMTP_USER,pass=process.env.SMTP_PASSWORD,port=Number(process.env.SMTP_PORT);
 if(!host||!user||!pass||![465,587].includes(port)||!z.email().safeParse(user).success)throw new DeliveryError(false,'SMTP_CONFIGURATION');
 const transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:true,auth:{user,pass},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:15000});
 try{const response=await transport.sendMail({from:{name:'PROSPERA Digital Solutions',address:user},to:input.recipient,
   subject:`PROSPERA quotation ${input.reference}`,text:`Please find your PROSPERA quotation ${input.reference} attached.`,messageId:`<${input.id}@prosperadigitalstudio.vercel.app>`,
   attachments:[{filename:`${input.reference}.pdf`,content:input.pdf,contentType:'application/pdf'}]});
  if(!response.accepted.some(address=>String(address).toLowerCase()===input.recipient.toLowerCase()))throw new DeliveryError(false,'SMTP_REJECTED');
  return {messageId:response.messageId,response:String(response.response).slice(0,1000),accountId:user};
 }catch(error){if(error instanceof DeliveryError)throw error;const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
  const response=error&&typeof error==='object'&&'responseCode' in error?Number(error.responseCode):0;
  throw new DeliveryError(!(['EAUTH','EDNS'].includes(code)||(response>=400&&response<=599)),response>=400&&response<=599?`SMTP_${response}`:'SMTP_SUBMISSION_ERROR');
 }finally{transport.close();}
}
export async function submitWhatsApp(input:{recipient:string;reference:string;pdf:Buffer;inSession:boolean}){
 const token=process.env.WHATSAPP_ACCESS_TOKEN,phone=process.env.WHATSAPP_PHONE_NUMBER_ID,version=process.env.META_GRAPH_API_VERSION;
 const template=process.env.WHATSAPP_QUOTATION_TEMPLATE,language=process.env.WHATSAPP_TEMPLATE_LANGUAGE;
 if(!token||!phone||!/^\d+$/.test(phone)||!version||!/^v\d{1,3}\.\d+$/.test(version))throw new DeliveryError(false,'WHATSAPP_CONFIGURATION');
 if(!input.inSession&&(!template||!language))throw new DeliveryError(false,'WHATSAPP_TEMPLATE_REQUIRED');
 let submitted=false;
 const call=async(path:string,body:BodyInit,json=false)=>{
  const response=await fetch(`https://graph.facebook.com/${version}/${phone}/${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,...(json?{'Content-Type':'application/json'}:{})},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok){await response.body?.cancel();throw new DeliveryError(false,`WHATSAPP_HTTP_${response.status}`);}
  const value=await response.text();if(value.length>65536)throw new Error();return JSON.parse(value) as unknown;
 };
 try{
  const data=new FormData();data.set('messaging_product','whatsapp');data.set('type','application/pdf');data.set('file',new Blob([new Uint8Array(input.pdf)],{type:'application/pdf'}),`${input.reference}.pdf`);
  const media=z.object({id:z.string().regex(/^\d+$/)}).parse(await call('media',data));
  const document={id:media.id,filename:`${input.reference}.pdf`};
  const content=template&&language?{type:'template',template:{name:template,language:{code:language},components:[{type:'header',parameters:[{type:'document',document}]}]}}:{type:'document',document};
  submitted=true;const sent=z.object({messages:z.array(z.object({id:z.string().min(1).max(512)})).min(1)}).parse(await call('messages',JSON.stringify({messaging_product:'whatsapp',to:input.recipient,recipient_type:'individual',...content}),true));
  return {messageId:sent.messages[0].id,response:JSON.stringify(sent).slice(0,1000),accountId:phone};
 }catch(error){if(error instanceof DeliveryError)throw error;throw new DeliveryError(submitted,'WHATSAPP_SUBMISSION_UNKNOWN');}
}
