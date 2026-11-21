/** Offline-first NLP baselines. No AI API call; not a large language model.
 * Keep source text in volatile browser memory. The search index is encrypted.
 */
import { analyzeFile } from './security-analysis';
export type Insight={status:'complete'|'partial'|'unsupported';summary:string[];actions:string[];deadlines:string[];keywords:string[];note:string;excerptLength:number};
const stop=new Set('và là có của cho trong những các một được để với về khi của từ sẽ theo được tại cũng này đó đây hoặc thì như còn là những trên dưới phần phải đến đã cần đang của hoặc and the for from that this with'.split(' '));
export function terms(text:string):string[]{
 const normalized=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
 return (normalized.match(/[a-z\d]{2,}/g)||[]).filter(w=>!stop.has(w));
}
const related:Record<string,string[]>={
 'bao mat':['mat ma','quyen truy cap','an toan','bi mat'],
 'tai chinh':['kinh phi','ngan sach','chi phi','thu chi'],
 'han chot':['thoi han','deadline','han nop','hoan thanh'],
 'hop dong':['thoa thuan','ky ket','dieu khoan'],
 'nhan su':['nhan vien','thanh vien','can bo'],
 'bao cao':['tong ket','ket qua','thong ke'],
 'ke hoach':['lo trinh','tien do','cong viec']
};
export function expandQuery(query:string):string[]{
 const words=new Set(terms(query));const simplified=terms(query).join(' ');
 for(const [k,rel] of Object.entries(related)){
  if(simplified.includes(k))for(const synonym of rel)for(const word of terms(synonym))words.add(word);
 }
 return [...words];
}
export function keywords(text:string,limit=12):string[]{
 const freq=new Map<string,number>();
 for(const word of terms(text).slice(0,28000))if(word.length>2)freq.set(word,(freq.get(word)||0)+1);
 return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(x=>x[0]);
}
export function insightFromText(text:string,partial=false):Insight{
 const normalized=text.replace(/\s+/g,' ').trim().slice(0,180_000);
 if(!normalized)return {status:'unsupported',summary:[],actions:[],deadlines:[],keywords:[],note:'Không tìm thấy văn bản có thể trích xuất.',excerptLength:0};
 const segments=normalized.split(/(?<=[.!?。])\s+|\n+/).map(x=>x.trim()).filter(s=>s.length>=25&&s.length<=650).slice(0,1000);
 const weights=new Map<string,number>();for(const part of segments)for(const token of new Set(terms(part)))weights.set(token,(weights.get(token)||0)+1);
 const scored=segments.map((sentence,i)=>({sentence,i,score:terms(sentence).reduce((n,w)=>n+Math.log(1+(segments.length+1)/(1+(weights.get(w)||0))),0)/Math.sqrt(Math.max(1,terms(sentence).length))}));
 const selected=scored.sort((a,b)=>b.score-a.score).slice(0,4).sort((a,b)=>a.i-b.i).map(s=>s.sentence);
 const actions=segments.filter(s=>/(phải|cần|yêu cầu|thực hiện|hoàn thành|trách nhiệm|nhiệm vụ|deadline|action item)/i.test(s)).slice(0,6);
 const dates=[...normalized.matchAll(/(?:\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}\b|\b20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2}\b)/g)].map(x=>x[0]);
 return {status:partial?'partial':'complete',summary:selected,actions,deadlines:[...new Set(dates)].slice(0,12),keywords:keywords(normalized),
   note:`Tóm tắt trích xuất theo TF-IDF trong trình duyệt${partial?' (chỉ phần văn bản đọc được)':''}; chưa phải mô hình ngôn ngữ AI và có thể bỏ sót thông tin.`,excerptLength:normalized.length};
}
export async function insightFromFile(file:File):Promise<Insight>{
 const scan=await analyzeFile(file);
 const text=scan.localText||'';
 if(!text.trim())return {status:'unsupported',summary:[],actions:[],deadlines:[],keywords:[],note:scan.note,excerptLength:0};
 const insight=insightFromText(text,scan.status!=='complete');
 insight.note+=` ${scan.note}`;
 return insight;
}
export type IndexedDocument={id:string;label:string;body:string;addedAt:string;status:string};
export type SearchHit={id:string;label:string;score:number;snippets:string[];status:string};
export function searchDocuments(docs:IndexedDocument[],query:string,allowed:Set<string>):SearchHit[]{
 const words=expandQuery(query);if(!words.length)return [];
 return docs.filter(d=>allowed.has(d.id)).map(d=>{
   const toks=terms(d.body),count=new Map<string,number>();for(const t of toks)count.set(t,(count.get(t)||0)+1);
   const labelTerms=terms(d.label);let score=0;
   for(const token of words){score+=(count.get(token)||0)/(Math.sqrt(toks.length||1));if(labelTerms.includes(token))score+=3;}
   const snippets=d.body.replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).filter(s=>words.some(w=>terms(s).includes(w))).slice(0,2).map(s=>s.slice(0,270));
   return {id:d.id,label:d.label,score:Math.round(score*100)/100,snippets,status:d.status};
 }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,30);
}
