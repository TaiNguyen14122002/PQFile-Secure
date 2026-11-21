/** Local-only document screening for the research prototype.
 * No source text, extracted PII or classification is sent to an API.
 * This is a small, explicitly unvalidated Naive Bayes model plus deterministic rules.
 */
export const CLASSIFICATIONS = ['Công khai', 'Nội bộ', 'Mật', 'Tối mật'] as const;
export type Classification = typeof CLASSIFICATIONS[number];
export type ScanState = 'complete' | 'partial' | 'unsupported';
export type PiiType = 'CCCD (dạng số)' | 'Điện thoại' | 'Email cá nhân' | 'Tài khoản tài chính' | 'Địa chỉ';
export type PiiFinding = { kind:PiiType; start:number; end:number; masked:string };
export type DocumentScan = {
  status:ScanState; note:string; suggestion:Classification; confidence:number;
  reasons:string[]; pii:PiiFinding[]; analyzedChars:number; originalSize:number;
  /** Kept in volatile browser memory; never serialize or send to backend. */
  localText?:string;
};
export type RiskLevel='Thấp'|'Trung bình'|'Cao'|'Nghiêm trọng';
export type RiskResult={score:number;level:RiskLevel;reasons:string[];actions:string[]};

// Small labeled seed corpus creates a genuine local multinomial NB classifier.
// It is a research baseline; corpus size is too small for operational accuracy.
const training:{label:Classification; text:string}[]=[
 {label:'Công khai',text:'thông cáo báo chí thông tin công khai giới thiệu sản phẩm sự kiện'},
 {label:'Công khai',text:'bản tin truyền thông website thông báo lịch họp công cộng'},
 {label:'Công khai',text:'tài liệu hướng dẫn sử dụng công bố bảng giá quảng bá'},
 {label:'Công khai',text:'brochure tin tức phổ biến kiến thức bài giảng'},
 {label:'Nội bộ',text:'quy trình nội bộ phòng ban kế hoạch phân công công việc'},
 {label:'Nội bộ',text:'báo cáo tiến độ nhân viên quy chế cuộc họp cơ quan'},
 {label:'Nội bộ',text:'danh sách công việc tài liệu lưu hành nội bộ tổ chức'},
 {label:'Nội bộ',text:'biên bản họp nhóm dự thảo dự án chưa công bố'},
 {label:'Mật',text:'hợp đồng bảo mật dữ liệu khách hàng mã định danh căn cước'},
 {label:'Mật',text:'thông tin cá nhân bảng lương tài khoản ngân hàng doanh thu'},
 {label:'Mật',text:'bí mật kinh doanh dữ liệu tài chính chiến lược chưa công bố'},
 {label:'Mật',text:'hồ sơ bệnh án chẩn đoán sức khỏe riêng tư'},
 {label:'Tối mật',text:'tối mật tuyệt mật chiến lược an ninh trọng yếu cấm sao chép'},
 {label:'Tối mật',text:'thông tin tuyệt mật quốc gia bí mật nhà nước độ tối mật'},
 {label:'Tối mật',text:'khóa bí mật private key seed phrase thông tin xác thực tuyệt đối'},
 {label:'Tối mật',text:'tài liệu đặc biệt nhạy cảm hạn chế nghiêm ngặt tối mật'}
];
function normalize(text:string){return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');}
function tokens(text:string){return normalize(text).match(/[a-z0-9]{2,}/g)||[];}
const bags=CLASSIFICATIONS.map(label=>{
 const counts=new Map<string,number>();let total=0;
 for(const row of training.filter(t=>t.label===label))for(const t of tokens(row.text)){counts.set(t,(counts.get(t)||0)+1);total++;}
 return {counts,total};
});
const vocabulary=new Set(training.flatMap(r=>tokens(r.text))).size;
export function modelPredict(text:string):{label:Classification;confidence:number}{
 const words=tokens(text).slice(0,3500);
 if(words.length<4)return {label:'Nội bộ',confidence:0};
 const scores=bags.map(b=>words.reduce((score,word)=>score+Math.log(((b.counts.get(word)||0)+1)/(b.total+vocabulary)),Math.log(.25)));
 const largest=Math.max(...scores),weights=scores.map(v=>Math.exp(v-largest));
 const total=weights.reduce((a,b)=>a+b,0),winner=weights.indexOf(Math.max(...weights));
 return {label:CLASSIFICATIONS[winner],confidence:Math.round(weights[winner]/total*100)};
}
function masked(value:string){return value.length<=4?'••••':`${value.slice(0,2)}${'•'.repeat(Math.min(value.length-4,9))}${value.slice(-2)}`;}
export function findPii(text:string):PiiFinding[]{
 const findings:PiiFinding[]=[];
 const patterns:{kind:PiiType;pattern:RegExp;test?:(value:string,index:number)=>boolean}[]=[
  {kind:'CCCD (dạng số)',pattern:/(?<!\d)\d{12}(?!\d)/g},
  {kind:'Điện thoại',pattern:/(?<!\d)(?:\+84|0)(?:[35789]\d{8})(?!\d)/g},
  {kind:'Email cá nhân',pattern:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi},
  {kind:'Tài khoản tài chính',pattern:/(?:số tài khoản|so tai khoan|stk|account|ngân hàng|ngan hang)\s*(?:số|so|:|#|-|là|la|\s){0,10}(\d[\d .-]{6,21}\d)/gi},
  {kind:'Địa chỉ',pattern:/(?:địa chỉ|dia chi|nơi ở|noi o|address)\s*[:：-]\s*([^\n;,.]{8,90})/gi}
 ];
 for(const {kind,pattern} of patterns){
  for(const match of text.matchAll(pattern)){
   const original=kind==='Tài khoản tài chính'&&match[1]?match[1]:kind==='Địa chỉ'&&match[1]?match[1]:match[0];
   if(kind==='Tài khoản tài chính'&&original.replace(/\D/g,'').length<8)continue;
   const offset=match[0].indexOf(original),start=(match.index||0)+Math.max(0,offset);
   if(findings.some(f=>start<f.end&&start+original.length>f.start))continue;
   findings.push({kind,start,end:start+original.length,masked:masked(original.trim())});
   if(findings.length>=150)break;
  }
  if(findings.length>=150)break;
 }
 return findings.sort((a,b)=>a.start-b.start);
}
export function analyzeText(text:string,originalSize=0,status:ScanState='complete',note=''):DocumentScan{
 const prediction=modelPredict(text),pii=findPii(text),lower=normalize(text),reasons:string[]=[];
 let index=CLASSIFICATIONS.indexOf(prediction.label);
 if(prediction.confidence<55){index=Math.max(index,1);reasons.push('Mô hình độ tin cậy thấp: tối thiểu Nội bộ');}
 if(pii.some(p=>p.kind==='CCCD (dạng số)'||p.kind==='Tài khoản tài chính')){index=Math.max(index,2);reasons.push('Phát hiện định danh hoặc dữ liệu tài chính có khả năng nhạy cảm');}
 else if(pii.length){index=Math.max(index,1);reasons.push('Phát hiện thông tin nhận diện cá nhân');}
 if(/\b(tuyet mat|toi mat|top secret)\b/.test(lower)){index=3;reasons.push('Từ khóa chỉ mức bảo mật đặc biệt');}
 else if(/\b(bao mat|bi mat|mat khau|password|luong|ben h an|benh an|ho so benh)\b/.test(lower)){
  index=Math.max(index,2);reasons.push('Từ khóa cần hạn chế chia sẻ');
 }
 if(status!=='complete'){index=Math.max(index,1);reasons.push('Nội dung chưa được quét đầy đủ, cần người dùng kiểm tra thủ công');}
 if(!reasons.length)reasons.push('Đề xuất bằng mô hình Naive Bayes cục bộ, chưa được kiểm định');
 return {status,note,suggestion:CLASSIFICATIONS[index],confidence:prediction.confidence,
  reasons,pii,analyzedChars:text.length,originalSize,localText:text};
}
// Strict size budget: no claims about PDF/image scanning; native-browser ZIP inflater
// supports typical DOCX text, subject to browser deflate-raw support.
const MAX_SCAN_BYTES=2*1024*1024;
function decodeXml(value:string){return value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,entity=>{
  const named:{[k:string]:string}={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
  if(named[entity])return named[entity];
  const num=entity.startsWith('&#x')?parseInt(entity.slice(3,-1),16):parseInt(entity.slice(2,-1),10);
  return Number.isFinite(num)&&num>0&&num<=0x10FFFF?String.fromCodePoint(num):'';
 });}
async function extractDocx(file:File):Promise<string>{
 if(typeof DecompressionStream==='undefined')throw new Error('Trình duyệt không hỗ trợ giải nén DOCX cục bộ');
 if(file.size>8*1024*1024)throw new Error('DOCX vượt giới hạn quét 8 MiB');
 const data=new Uint8Array(await file.arrayBuffer()),view=new DataView(data.buffer),count=data.length;
 let eocd=-1;
 for(let i=count-22;i>=Math.max(0,count-65557);i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}}
 if(eocd<0)throw new Error('Không tìm thấy danh mục ZIP trong DOCX');
 const entries=view.getUint16(eocd+10,true);const start=view.getUint32(eocd+16,true);
 let pos=start;
 for(let i=0;i<entries&&pos+46<=count;i++){
  if(view.getUint32(pos,true)!==0x02014b50)break;
  const method=view.getUint16(pos+10,true),size=view.getUint32(pos+20,true),outSize=view.getUint32(pos+24,true);
  const nameLength=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true);
  const offset=view.getUint32(pos+42,true),name=new TextDecoder().decode(data.slice(pos+46,pos+46+nameLength));
  pos+=46+nameLength+extra+comment;
  if(name!=='word/document.xml')continue;
  if(size>MAX_SCAN_BYTES||outSize>MAX_SCAN_BYTES||offset+30>count||view.getUint32(offset,true)!==0x04034b50)throw new Error('DOCX vượt giới hạn giải nén an toàn');
  const p=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);
  if(p+size>count)throw new Error('DOCX bị cắt ngắn');
  let out:Uint8Array;
  if(method===0)out=data.slice(p,p+size);
  else if(method===8){
   const decompressed=new Blob([data.slice(p,p+size)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
   // Avoid decompression bombs, including incorrect ZIP size declarations.
   const reader=decompressed.getReader();const chunks:Uint8Array[]=[];let total=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_SCAN_BYTES)throw new Error('DOCX giải nén quá giới hạn');chunks.push(value);}}finally{reader.releaseLock();}
   out=new Uint8Array(total);let cursor=0;for(const c of chunks){out.set(c,cursor);cursor+=c.length;}
  }else throw new Error('DOCX có kiểu nén chưa hỗ trợ');
  const xml=new TextDecoder('utf-8').decode(out);
  // Preserve split Word runs: digits within a CCCD can span multiple <w:t> nodes.
  return xml.split(/<\/w:p>/i).map(paragraph=>{
    const runs=[...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/gi)];
    return runs.map(match=>decodeXml(match[1])).join('');
  }).join('\n');
 }
 throw new Error('Không đọc được nội dung DOCX');
}
export async function analyzeFile(file:File):Promise<DocumentScan>{
 const ext=file.name.toLowerCase().split('.').pop()||'';
 const textual=['txt','md','csv','log','json','xml','html','htm','yaml','yml','tsv'];
 try{
  if(textual.includes(ext)||file.type.startsWith('text/')){
   const partial=file.size>MAX_SCAN_BYTES;
   const text=await file.slice(0,MAX_SCAN_BYTES).text();
   return analyzeText(text,file.size,partial?'partial':'complete',partial?'Chỉ quét 2 MiB đầu tiên; phần còn lại chưa kiểm tra.':'Đã quét văn bản cục bộ.');
  }
  if(ext==='pdf'){
   if(file.size>20*1024*1024)throw new Error('PDF vượt giới hạn phân tích 20 MiB');
   // PDF.js and worker ship as part of the local web bundle; no external PDF API.
   const [pdfjs,worker]=await Promise.all([
     import('pdfjs-dist/legacy/build/pdf.mjs'),
     import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
   ]);
   pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
   const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
   const doc=await task.promise;
   try{
    const parts:string[]=[];let chars=0;const pages=Math.min(doc.numPages,50);
    for(let i=1;i<=pages;i++){
     const page=await doc.getPage(i);
     const content=await page.getTextContent();
     const text=content.items.map(item=>'str' in item?String(item.str):'').join(' ');
     parts.push(text);chars+=text.length;
     if(chars>=180_000)break;
    }
    const text=parts.join('\n');
    if(!text.trim())throw new Error('PDF không có lớp văn bản đọc được (có thể là bản scan ảnh)');
    return analyzeText(text,file.size,'partial',`Đọc lớp văn bản từ tối đa ${parts.length}/${doc.numPages} trang PDF trên thiết bị; chưa OCR, chưa đọc ảnh và đối tượng đính kèm. Cần kiểm tra thủ công.`);
   }finally{await task.destroy();}
  }
  if(ext==='docx'){
   const text=await extractDocx(file);
   return analyzeText(text,file.size,'partial','Chỉ quét văn bản chính DOCX; chưa kiểm tra đầu trang, chân trang, ảnh hoặc đối tượng nhúng. Cần xác nhận thủ công.');
  }
 }catch(e:any){return analyzeText('',file.size,'unsupported',`Không thể phân tích ${ext.toUpperCase()}: ${e?.message||'lỗi đọc tệp'}. Chọn mức thủ công.`);}
 return analyzeText('',file.size,'unsupported',`Chưa hỗ trợ trích xuất ${ext.toUpperCase()||'định dạng này'} (ảnh cần OCR cục bộ). Chọn mức thủ công.`);
}
export const canRedact=(fileName:string,scan:DocumentScan)=>scan.status==='complete' && /\.(txt|md|csv|log|tsv)$/i.test(fileName) && !!scan.pii.length && typeof scan.localText==='string';
export function redactedCopy(file:File,scan:DocumentScan):File{
 if(!canRedact(file.name,scan))throw new Error('Định dạng này chưa hỗ trợ tạo bản sao che thông tin an toàn.');
 let text=scan.localText!;
 for(const finding of [...scan.pii].sort((a,b)=>b.start-a.start))text=text.slice(0,finding.start)+'[ĐÃ ẨN]'+text.slice(finding.end);
 const name=file.name.replace(/(\.[^.]+)$/, '-da-an$1');
 return new File([text],name,{type:file.type||'text/plain',lastModified:Date.now()});
}
export function shareRisk(input:{classification:Classification;recipients:number;days:number|null;alerts:number;scanStatus:ScanState;isNewRecipient:boolean}):RiskResult{
 let score=([0,15,38,64] as number[])[CLASSIFICATIONS.indexOf(input.classification)];
 const reasons:string[]=[];const actions:string[]=[];
 if(input.classification==='Mật'||input.classification==='Tối mật')reasons.push('Tài liệu được phân loại nhạy cảm');
 if(input.recipients>=5){score+=25;reasons.push('Đã có nhiều người nhận');}
 else if(input.recipients>=2){score+=12;reasons.push('Có nhiều người nhận');}
 else if(input.recipients>=1){score+=6;}
 if(input.days===null){score+=23;reasons.push('Không có thời hạn chia sẻ');actions.push('Đặt thời hạn 1–7 ngày');}
 else if(input.days>30){score+=18;reasons.push('Thời hạn dài hơn 30 ngày');actions.push('Rút ngắn thời hạn');}
 else if(input.days>7){score+=8;reasons.push('Thời hạn dài hơn 7 ngày');}
 if(input.alerts>0){score+=Math.min(20,input.alerts*7);reasons.push('Tài khoản có cảnh báo an ninh chưa xem xét');}
 if(input.scanStatus!=='complete'){score+=20;reasons.push('Không thể xác nhận toàn bộ nội dung tệp');actions.push('Kiểm tra thủ công trước khi chia sẻ');}
 if(input.isNewRecipient){score+=5;reasons.push('Cấp quyền cho người nhận mới');}
 score=Math.min(100,score);
 const level:RiskLevel=score>=80?'Nghiêm trọng':score>=55?'Cao':score>=30?'Trung bình':'Thấp';
 if(score>=55)actions.push('Xác minh danh tính và fingerprint người nhận qua kênh độc lập');
 if(input.classification==='Mật'||input.classification==='Tối mật')actions.push('Cân nhắc gửi bản sao đã che thông tin cá nhân');
 return {score,level,reasons:[...new Set(reasons)],actions:[...new Set(actions)]};
}
export function cryptoRecommendation(classification:Classification,size:number,deviceMemoryGb?:number):{
 kem:'ML-KEM-512'|'ML-KEM-768'|'ML-KEM-1024';note:string;warning:string;
}{
 const level=CLASSIFICATIONS.indexOf(classification);
 const kem=level>=3?'ML-KEM-1024':level>=1?'ML-KEM-768':'ML-KEM-512';
 const perfHint=size>10*1024*1024?' Tệp lớn chủ yếu chịu chi phí AES-GCM, không phải ML-KEM.':'';
 const deviceHint=deviceMemoryGb&&deviceMemoryGb<=2?' Thiết bị ít RAM: cân nhắc thử hiệu năng trước.':'';
 return {kem,note:`Khuyến nghị nghiên cứu ${kem} cho mức ${classification}.${perfHint}${deviceHint}`,
  warning:'Không được tự động chuyển tham số của bộ khóa hiện có. Cần tạo/đăng ký bộ khóa tương ứng nếu muốn đổi.'};
}
