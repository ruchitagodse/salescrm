import PDFDocument from 'pdfkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatINR } from './money.ts';
export type QuotationSnapshot={
 reference:string;issuedOn:string;title:string;description:string|null;validUntil:string|null;paymentTerms:string|null;notes:string|null;
 client:{name:string;company:string|null;email:string|null;phone:string|null;city:string|null};
 brand:{name:string;website:string;address:string|null;email:string|null;phone:string|null;signOff:string};
 items:{description:string;quantity:number;unitPricePaise:string;lineTotalPaise:string}[];
 subtotalPaise:string;discountPaise:string;taxPaise:string;totalPaise:string;milestones:{label:string;amountPaise:string}[];
};
const money=(v:string)=>formatINR(v).replace('₹','INR ');
export async function renderQuotationPdf(s:QuotationSnapshot):Promise<Buffer>{
 const doc=new PDFDocument({size:'A4',margins:{top:100,bottom:65,left:48,right:48},bufferPages:true,info:{Title:`${s.reference} - ${s.title}`,Author:s.brand.name}});
 const buffers:Buffer[]=[];
 const ready=new Promise<Buffer>((resolve,reject)=>{doc.on('data',c=>buffers.push(c));doc.on('end',()=>resolve(Buffer.concat(buffers)));doc.on('error',reject);});
 doc.registerFont('Body',readFileSync(join(process.cwd(),'src/assets/fonts/NotoSans-Full.ttf')));
 doc.registerFont('Bold',readFileSync(join(process.cwd(),'src/assets/fonts/NotoSans-Bold.woff')));
 const header=()=>{
  doc.save().rect(0,0,doc.page.width,76).fill('#122c3b');
  doc.font('Bold').fontSize(24).fillColor('white').text('PROSPERA',48,20,{lineBreak:false});
  doc.font('Body').fontSize(9).text('DIGITAL SOLUTIONS',49,50,{lineBreak:false});
  doc.font('Bold').fontSize(11).text('QUOTATION',400,25,{width:147,align:'right',lineBreak:false});
  doc.restore();doc.font('Body').fontSize(10).fillColor('#243b4a');doc.y=100;
 };
 header();doc.on('pageAdded',header);
 const room=(height:number)=>{if(doc.y+height>doc.page.height-80)doc.addPage();};
 const section=(title:string)=>{room(50);doc.moveDown(.5).font('Bold').fontSize(12).fillColor('#116b61').text(title,48);doc.moveDown(.2).font('Body').fontSize(10).fillColor('#243b4a');};
 doc.font('Body').fontSize(18).text(s.title,48,100,{width:499});doc.moveDown(.5).fontSize(10);
 doc.text(`${s.reference}    |    Issued ${s.issuedOn}${s.validUntil?`    |    Valid through ${s.validUntil}`:''}`);
 section('Prepared for');doc.font('Body').text(s.client.name);
 for(const line of [s.client.company,s.client.email,s.client.phone,s.client.city])if(line)doc.text(line);
 if(s.description){section('Project overview');doc.text(s.description,{width:499});}
 section('Scope and investment');
 const tableHeader=()=>{room(32);const y=doc.y;doc.rect(48,y,499,24).fill('#e8f2ef');doc.fillColor('#122c3b').font('Bold').fontSize(9);doc.text('DESCRIPTION',56,y+6,{width:249});doc.text('QTY',310,y+6,{width:35});doc.text('UNIT PRICE',348,y+6,{width:90,align:'right'});doc.text('AMOUNT',440,y+6,{width:99,align:'right'});doc.y=y+32;doc.font('Body').fillColor('#243b4a');};
 tableHeader();
 for(const item of s.items){
  doc.font('Body').fontSize(9);
  // Bound each visual fragment; long descriptions continue on another page.
  const words=item.description.split(/\s+/);const lines:string[]=[];let line='';
  for(const word of words){
   if(doc.widthOfString(`${line} ${word}`)>235&&line){lines.push(line);line='';}
   for(const char of word){if(doc.widthOfString(line+char)>235){lines.push(line);line='';}line+=char;}line+=' ';
  }if(line.trim())lines.push(line.trim());if(!lines.length)lines.push('');
  for(let start=0;start<lines.length;start+=18){const chunk=lines.slice(start,start+18);const height=Math.max(38,chunk.length*15+14);if(doc.y+height>doc.page.height-80){doc.addPage();tableHeader();}
   const y=doc.y;doc.font('Body').fontSize(9);chunk.forEach((line,index)=>doc.text(line,56,y+index*15,{lineBreak:false}));
   if(start===0){doc.fontSize(8);doc.text(String(item.quantity),310,y,{width:35});doc.text(money(item.unitPricePaise),345,y,{width:94,align:'right'});doc.text(money(item.lineTotalPaise),442,y,{width:97,align:'right'});doc.fontSize(9);}
   doc.y=y+height;doc.moveTo(48,doc.y-5).lineTo(547,doc.y-5).strokeColor('#dbe6e6').stroke();
  }
 }
 room(130);section('Quotation totals');
 for(const [label,value] of [['Subtotal',s.subtotalPaise],['Discount',s.discountPaise],['Tax (fixed amount)',s.taxPaise],['Total',s.totalPaise]]){
  const y=doc.y;doc.font(label==='Total'?'Bold':'Body').fontSize(label==='Total'?13:10).text(label,300,y,{width:115});doc.text(money(value),410,y,{width:137,align:'right'});doc.y=y+23;
 }
 if(s.milestones.length){section('Payment milestones');for(const m of s.milestones){room(40);doc.text(`${m.label}  -  ${money(m.amountPaise)}`,48,doc.y,{width:499});doc.moveDown(.4);}}
 if(s.paymentTerms){section('Payment terms');doc.text(s.paymentTerms,{width:499});}
 if(s.notes){section('Notes');doc.text(s.notes,{width:499});}
 room(85+[s.brand.address,s.brand.email,s.brand.phone].filter(Boolean).length*15);section('Authorized sign-off');doc.text(s.brand.signOff);doc.text(s.brand.name);doc.moveDown(.5);
 for(const line of [s.brand.address,s.brand.email,s.brand.phone,s.brand.website])if(line)doc.text(line,{width:499});
 const pages=doc.bufferedPageRange();for(let p=pages.start;p<pages.start+pages.count;p++){doc.switchToPage(p);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;doc.font('Body').fontSize(8).fillColor('#637580').text(`${s.reference}  |  PROSPERA  |  ${p+1} / ${pages.count}`,48,doc.page.height-37,{width:499,align:'center',lineBreak:false});doc.page.margins.bottom=bottom;}
 doc.end();return ready;
}
