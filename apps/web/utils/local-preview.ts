/**
 * Read-only, local previews for verified/decrypted blobs. No server-side plaintext
 * processing, HTML execution, embedded document scripts, or external assets.
 * In particular, Word/Excel/PowerPoint are parsed as documents, not iframed.
 */
export type PreviewKind = 'pdf' | 'image' | 'text' | 'markdown' | 'document' | 'spreadsheet' | 'slides' | 'audio' | 'video' | 'binary' | 'blocked';
export type PreviewSheet = { name: string; rows: string[][] };
export type PreviewSlide = { title: string; lines: string[] };
export type LocalPreview = {
  kind: PreviewKind;
  name: string;
  mime: string;
  url: string;
  text?: string;
  html?: string;
  sheets?: PreviewSheet[];
  slides?: PreviewSlide[];
  note?: string;
};

const TEXT_BUDGET = 2 * 1024 * 1024;
const OFFICE_INPUT_BUDGET = 24 * 1024 * 1024;
const OFFICE_ENTRY_BUDGET = 12 * 1024 * 1024;
const OFFICE_SESSION_BUDGET = 32 * 1024 * 1024;
const MAX_ENTRIES = 1800;
const blockedExtensions = new Set(['zip','rar','7z','tar','gz','tgz','bz2','xz','zst','cab','iso','dmg','jar','apk']);
const textExtensions = new Set(['txt','log','mdown','markdown','csv','tsv','json','jsonl','xml','yaml','yml','toml','ini','cfg','conf','properties','sql','py','js','jsx','ts','tsx','css','scss','html','htm','vue','java','c','cpp','h','hpp','cs','go','rs','sh','bat','ps1','rb','php','swift','kt','ipynb','eml','ics','vcf','tex','env','gitignore']);
const imageTypes: Record<string,string> = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp',avif:'image/avif',ico:'image/x-icon'};
const audioTypes: Record<string,string> = {mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',flac:'audio/flac',opus:'audio/ogg'};
const videoTypes: Record<string,string> = {mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',m4v:'video/mp4',ogv:'video/ogg'};
export const extensionOf = (name:string) => name.trim().toLowerCase().split('/').pop()?.split('.').pop() || '';
export const isPreviewBlocked = (name:string) => /[\\/]$/.test(name) || blockedExtensions.has(extensionOf(name));
export const escapePreviewHtml = (value:string) => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));
const elText = (root: Element, tag: string) => Array.from(root.getElementsByTagName('*')).filter(el=>el.localName===tag).map(el=>el.textContent||'').join('');
function elements(root: Element | Document, tag:string):Element[] {
  return Array.from(root.getElementsByTagName('*')).filter(el=>el.localName===tag);
}
function parseXml(source:string): Document {
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('Tài liệu XML có cấu trúc không hợp lệ.');
  return doc;
}

/** Read only named ZIP entries after validating central-directory size declarations. */
class OfficeZip {
  private bytes: Uint8Array;
  private entries = new Map<string,{method:number;size:number;unpacked:number;offset:number}>();
  private totalRead=0;
  private constructor(bytes:Uint8Array){this.bytes=bytes;}
  static async from(blob:Blob):Promise<OfficeZip>{
    if(blob.size>OFFICE_INPUT_BUDGET)throw new Error('Tệp văn phòng vượt giới hạn xem trước 24 MiB; vui lòng tải xuống để mở đầy đủ.');
    const zip = new OfficeZip(new Uint8Array(await blob.arrayBuffer()));
    zip.index();return zip;
  }
  names():string[]{return [...this.entries.keys()];}
  private index(){
    const b=this.bytes,v=new DataView(b.buffer,b.byteOffset,b.byteLength);
    if(b.length<22)throw new Error('Không tìm thấy cấu trúc tệp văn phòng hợp lệ.');
    let eocd=-1;
    for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(v.getUint32(i,true)===0x06054b50){eocd=i;break;}}
    if(eocd<0)throw new Error('Tệp văn phòng không có bảng nội dung ZIP.');
    const count=v.getUint16(eocd+10,true),centralSize=v.getUint32(eocd+12,true),centralOffset=v.getUint32(eocd+16,true);
    if(count>MAX_ENTRIES||count===65535||centralOffset===0xffffffff||centralSize===0xffffffff)
      throw new Error('Tệp có quá nhiều thành phần hoặc sử dụng ZIP64 chưa hỗ trợ.');
    if(centralOffset+centralSize>eocd)throw new Error('Danh mục tệp văn phòng bị lỗi.');
    let ptr=centralOffset;
    for(let i=0;i<count;i++){
      if(ptr+46>b.length||v.getUint32(ptr,true)!==0x02014b50)throw new Error('Danh mục tệp văn phòng bị lỗi.');
      const flags=v.getUint16(ptr+8,true),method=v.getUint16(ptr+10,true);
      const size=v.getUint32(ptr+20,true),unpacked=v.getUint32(ptr+24,true);
      const len=v.getUint16(ptr+28,true),extra=v.getUint16(ptr+30,true),comment=v.getUint16(ptr+32,true);
      const offset=v.getUint32(ptr+42,true);
      if(ptr+46+len+extra+comment>b.length)throw new Error('Tên thành phần văn phòng bị cắt ngắn.');
      const name=new TextDecoder().decode(b.subarray(ptr+46,ptr+46+len));ptr+=46+len+extra+comment;
      if((flags&1)||![0,8].includes(method)||size>OFFICE_ENTRY_BUDGET||unpacked>OFFICE_ENTRY_BUDGET||offset+30>b.length)
        throw new Error('Tệp văn phòng dùng mã hóa/kiểu nén chưa hỗ trợ hoặc chứa thành phần quá lớn.');
      this.entries.set(name,{method,size,unpacked,offset});
    }
  }
  async read(name:string):Promise<string|null>{
    const entry=this.entries.get(name);if(!entry)return null;
    const b=this.bytes,v=new DataView(b.buffer,b.byteOffset,b.byteLength),o=entry.offset;
    if(v.getUint32(o,true)!==0x04034b50)throw new Error('Phần dữ liệu ZIP không hợp lệ.');
    const p=o+30+v.getUint16(o+26,true)+v.getUint16(o+28,true);
    if(p+entry.size>b.length)throw new Error('Tệp văn phòng có dữ liệu bị cắt ngắn.');
    let result:Uint8Array;
    if(entry.method===0)result=b.slice(p,p+entry.size);
    else {
      if(typeof DecompressionStream==='undefined')throw new Error('Trình duyệt không hỗ trợ giải nén tài liệu cục bộ.');
      const stream = new Blob([b.slice(p,p+entry.size)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const reader=stream.getReader(),chunks:Uint8Array[]=[];let length=0;
      try {
        while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
          if(length>OFFICE_ENTRY_BUDGET||this.totalRead+length>OFFICE_SESSION_BUDGET){void reader.cancel().catch(()=>{});throw new Error('Đã dừng giải nén vì vượt ngưỡng an toàn.');}
          chunks.push(value);
        }
      }finally{reader.releaseLock();}
      result=new Uint8Array(length);let cursor=0;
      for(const chunk of chunks){result.set(chunk,cursor);cursor+=chunk.length;}
    }
    if(result.byteLength!==entry.unpacked)throw new Error('Kích thước thành phần văn phòng không khớp.');
    this.totalRead+=result.byteLength;
    if(this.totalRead>OFFICE_SESSION_BUDGET)throw new Error('Vượt giới hạn trích xuất nội dung an toàn.');
    return new TextDecoder('utf-8',{fatal:false}).decode(result);
  }
}

function docxText(p:Element):string{
  let text='';
  // <w:t> split across multiple runs is kept in the original order.
  for(const node of elements(p,'t'))text+=node.textContent||'';
  return text.trim();
}
function docxHtml(xml:string):string{
  const doc=parseXml(xml),body=elements(doc,'body')[0];if(!body)throw new Error('DOCX không có nội dung chính.');
  const result:string[]=[];
  for(const child of Array.from(body.children).slice(0,2500)){
    if(child.localName==='p'){
      const text=docxText(child);if(!text)continue;
      const style=elements(child,'pStyle')[0]?.getAttribute('w:val')||elements(child,'pStyle')[0]?.getAttribute('val')||'';
      const heading=/^heading\s*([1-4])$/i.exec(style);
      const tag=heading?`h${heading[1]}`:'p';result.push(`<${tag}>${escapePreviewHtml(text)}</${tag}>`);
    }else if(child.localName==='tbl'){
      const trs=Array.from(child.children).filter(n=>n.localName==='tr').slice(0,200);
      const rows=trs.map(tr=>'<tr>'+Array.from(tr.children).filter(n=>n.localName==='tc').slice(0,32).map(td=>`<td>${escapePreviewHtml(docxText(td))}</td>`).join('')+'</tr>');
      result.push(`<div class="reader-table-scroll"><table>${rows.join('')}</table></div>`);
    }
  }
  return result.join('')||'<p>Không tìm thấy lớp văn bản trong tài liệu Word.</p>';
}
const colIndex=(cell:string)=>{
  let n=0;for(const ch of cell.toUpperCase().match(/^[A-Z]+/)?.[0]||'')n=n*26+ch.charCodeAt(0)-64;return n-1;
};
function parseCsv(content:string,separator:string):PreviewSheet[]{
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<content.length&&rows.length<250;i++){
    const c=content[i];
    if(c==='"'){if(quoted&&content[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===separator&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);rows.push(row.slice(0,40));row=[];cell='';if(c==='\r'&&content[i+1]==='\n')i++;}
    else cell+=c;
  }
  if(rows.length<250&&(cell||row.length)){row.push(cell);rows.push(row.slice(0,40));}
  return [{name:'Dữ liệu',rows}];
}
async function workbookSheets(zip:OfficeZip):Promise<PreviewSheet[]>{
  const wbXml=await zip.read('xl/workbook.xml');if(!wbXml)throw new Error('XLSX thiếu workbook.xml.');
  const wb=parseXml(wbXml),relsXml=await zip.read('xl/_rels/workbook.xml.rels');
  const rels = new Map<string,string>();
  if(relsXml)for(const rel of elements(parseXml(relsXml),'Relationship')){
    const id=rel.getAttribute('Id'),target=rel.getAttribute('Target');
    if(id&&target&&!rel.getAttribute('TargetMode'))rels.set(id,target);
  }
  let strings:string[]=[];
  const strXml=await zip.read('xl/sharedStrings.xml');
  if(strXml)strings=elements(parseXml(strXml),'si').slice(0,100000).map(si=>elText(si,'t'));
  const sheets:PreviewSheet[]=[];
  const declared=elements(wb,'sheet').slice(0,14);
  for(let i=0;i<declared.length;i++){
    const entry=declared[i],relationship=entry.getAttribute('r:id')||entry.getAttribute('id')||'';
    const target=rels.get(relationship)||`worksheets/sheet${i+1}.xml`;
    // Never read external or traversal paths from a workbook relationship.
    const full=target.startsWith('/xl/')?target.slice(1):target.startsWith('xl/')?target:`xl/${target}`;
    if(full.split('/').includes('..'))continue;
    const xml=await zip.read(full);if(!xml)continue;
    const sheet=parseXml(xml),rows:string[][]=[];
    for(const row of elements(sheet,'row').slice(0,200)){
      const cells:string[]=[];
      for(const cell of Array.from(row.children).filter(e=>e.localName==='c').slice(0,64)){
        const addr=cell.getAttribute('r')||'',column=colIndex(addr);
        if(column<0||column>=40)continue;
        const raw=elements(cell,'v')[0]?.textContent||'';
        const type=cell.getAttribute('t');
        const val=type==='s'?strings[Number(raw)]||'':type==='inlineStr'?elText(cell,'t'):type==='b'?(raw==='1'?'TRUE':'FALSE'):raw;
        cells[column]=val;
      }
      rows.push(Array.from({length:Math.min(40,cells.length)},(_,k)=>cells[k]||''));
    }
    sheets.push({name:entry.getAttribute('name')||`Sheet ${i+1}`,rows});
  }
  return sheets.length?sheets:[{name:'Bảng tính',rows:[]}];
}
async function powerpointSlides(zip:OfficeZip):Promise<PreviewSlide[]>{
  const names=zip.names().filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a,b)=>Number(a.match(/slide(\d+)/)?.[1]||0)-Number(b.match(/slide(\d+)/)?.[1]||0));
  const slides:PreviewSlide[]=[];
  for(const name of names.slice(0,50)){
    const xml=await zip.read(name);if(!xml)continue;
    const doc=parseXml(xml),lines=elements(doc,'p').map(p=>elText(p,'t').trim()).filter(Boolean).slice(0,100);
    slides.push({title:lines.shift()||`Trang chiếu ${slides.length+1}`,lines});
  }
  return slides;
}
function openDocumentHtml(xml:string):string{
  const doc=parseXml(xml),p=elements(doc,'p').concat(elements(doc,'h')).slice(0,1200);
  return p.map(node=>`<p>${escapePreviewHtml(node.textContent?.trim()||'')}</p>`).join('')||'<p>Không tìm thấy lớp văn bản.</p>';
}
function rtfText(input:string):string{
  return input.replace(/\\u(-?\d+)\??/g,(_a,n)=>String.fromCharCode((Number(n)+65536)%65536))
    .replace(/\\'[0-9a-fA-F]{2}/g,'').replace(/\\(?:par|line)\b ?/g,'\n')
    .replace(/\\[a-zA-Z]+-?\d* ?/g,'').replace(/[{}]/g,'').replace(/\\([{}\\])/g,'$1');
}
function looksLikePdf(b:Uint8Array){return b.length>=5&&String.fromCharCode(...b.slice(0,5))==='%PDF-';}
function imageSignatureOK(ext:string,b:Uint8Array){
  const chars=(s:number,e:number)=>String.fromCharCode(...b.slice(s,e));
  if(['jpg','jpeg'].includes(ext))return b[0]===0xff&&b[1]===0xd8;
  if(ext==='png')return b[0]===137&&chars(1,4)==='PNG';
  if(ext==='gif')return chars(0,3)==='GIF';
  if(ext==='webp')return chars(0,4)==='RIFF'&&chars(8,12)==='WEBP';
  if(ext==='bmp')return chars(0,2)==='BM';
  if(ext==='ico')return b[0]===0&&b[1]===0&&b[2]===1&&b[3]===0;
  if(ext==='avif')return chars(4,8)==='ftyp';
  return false;
}
function binarySummary(name:string,blob:Blob,reason:string):LocalPreview {
  return {name,kind:'binary',mime:'application/octet-stream',url:'',note:reason};
}
export async function prepareLocalPreview(name:string,blob:Blob):Promise<LocalPreview>{
  const ext=extensionOf(name);
  if(isPreviewBlocked(name))return {kind:'blocked',name,mime:'',url:'',note:'Không xem trước tệp nén hoặc thư mục. Bạn có thể tải về sau khi xác minh chữ ký.'};
  if(ext==='pdf'){
    const head=new Uint8Array(await blob.slice(0,10).arrayBuffer());
    if(!looksLikePdf(head))return binarySummary(name,blob,'Đuôi PDF không khớp chữ ký định dạng. Không mở bản xem trước để tránh rủi ro.');
    return {kind:'pdf',name,mime:'application/pdf',url:URL.createObjectURL(new Blob([blob],{type:'application/pdf'}))};
  }
  if(imageTypes[ext]){
    const head=new Uint8Array(await blob.slice(0,16).arrayBuffer());
    if(!imageSignatureOK(ext,head))return binarySummary(name,blob,'Tệp ảnh có chữ ký định dạng không khớp; không hiển thị như ảnh.');
    return {kind:'image',name,mime:imageTypes[ext],url:URL.createObjectURL(new Blob([blob],{type:imageTypes[ext]}))};
  }
  if(audioTypes[ext]||videoTypes[ext]){
    const mime=audioTypes[ext]||videoTypes[ext];
    return {kind:audioTypes[ext]?'audio':'video',name,mime,url:URL.createObjectURL(new Blob([blob],{type:mime})),
      note:'Phát nội dung ngay trong trình duyệt. Khả năng phát phụ thuộc bộ giải mã (codec) của thiết bị.'};
  }
  if(ext==='docx'||ext==='xlsx'||ext==='pptx'||['odt','ods','odp'].includes(ext)){
    const zip=await OfficeZip.from(blob);
    if(ext==='docx'){
      const xml=await zip.read('word/document.xml');if(!xml)throw new Error('Không tìm thấy nội dung DOCX.');
      return {kind:'document',name,mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',url:'',html:docxHtml(xml),
        note:'Chế độ đọc Word cục bộ: giữ văn bản, tiêu đề và bảng; ảnh, biểu đồ và bố cục phức tạp có thể khác bản gốc.'};
    }
    if(ext==='xlsx')return {kind:'spreadsheet',name,mime:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',url:'',sheets:await workbookSheets(zip),
      note:'Xem dữ liệu của tối đa 14 sheet, mỗi sheet 200 dòng × 40 cột. Công thức không được tính lại; nên đối chiếu trong phần mềm bảng tính khi cần.'};
    if(ext==='pptx')return {kind:'slides',name,mime:'application/vnd.openxmlformats-officedocument.presentationml.presentation',url:'',slides:await powerpointSlides(zip),
      note:'Xem phần chữ của tối đa 50 trang chiếu. Hình ảnh, hiệu ứng và bố cục gốc chưa được tái tạo.'};
    const xml=await zip.read('content.xml');if(!xml)throw new Error('Không tìm thấy nội dung OpenDocument.');
    return {kind:'document',name,mime:'text/html',url:'',html:openDocumentHtml(xml),
      note:'Chế độ đọc nội dung OpenDocument; định dạng và các đối tượng nhúng có thể không đầy đủ.'};
  }
  if(ext==='csv'||ext==='tsv'){
    const text=await blob.slice(0,TEXT_BUDGET).text();
    return {kind:'spreadsheet',name,mime:'text/plain',url:'',sheets:parseCsv(text,ext==='csv'?',':'\t'),
      note:blob.size>TEXT_BUDGET?'Bản xem trước chỉ đọc 2 MiB đầu tiên.':'Chế độ bảng dữ liệu; hiển thị tối đa 250 dòng và 40 cột.'};
  }
  if(ext==='md'||ext==='markdown'||ext==='mdown'){
    const text=await blob.slice(0,TEXT_BUDGET).text();
    // External links/images must not be fetched automatically when showing secrets.
    // markdown-it is a callable factory. Avoid `new` here: mismatched ESM/CJS
    // interop in some production bundles yielded "<minified> is not a constructor".
    // A missing optional renderer must not break an already verified document.
    let rendered = `<pre class="reader-markdown-fallback">${escapePreviewHtml(text)}</pre>`;
    let rendererWarning = '';
    try {
      const loaded = await import('markdown-it');
      const candidate: unknown = loaded.default;
      const factory: unknown = typeof candidate === 'function' ? candidate
        : candidate && typeof candidate === 'object' && 'default' in candidate
          ? (candidate as {default: unknown}).default : null;
      if (typeof factory !== 'function') throw new TypeError('Không tìm thấy Markdown renderer hợp lệ');
      type MarkdownRenderer = {render:(input:string)=>string; renderer:{rules:Record<string,any>}};
      const markdown = (factory as (options:Record<string,unknown>)=>MarkdownRenderer)({html:false,linkify:false,breaks:true,typographer:true});
      if (!markdown || typeof markdown.render !== 'function') throw new TypeError('Markdown renderer không hỗ trợ render');
      markdown.renderer.rules.image=(tokens:any[],idx:number)=>`<span class="reader-omitted-image">[Hình ảnh không được tải tự động: ${escapePreviewHtml(tokens[idx]?.content||'')}]</span>`;
      const prevOpen=markdown.renderer.rules.link_open;
      markdown.renderer.rules.link_open=(tokens:any[],idx:number,opts:any,env:any,self:any)=>{
        tokens[idx].attrSet('target','_blank');tokens[idx].attrSet('rel','noopener noreferrer nofollow');
        return prevOpen?prevOpen(tokens,idx,opts,env,self):self.renderToken(tokens,idx,opts);
      };
      rendered=markdown.render(text);
    } catch {
      rendererWarning='Bộ đọc Markdown chưa khởi tạo được; hiển thị mã nguồn đã được vô hiệu hóa HTML để không gián đoạn xem trước. ';
    }
    return {kind:'markdown',name,mime:'text/markdown',url:'',text,html:rendered,
      note:rendererWarning+(blob.size>TEXT_BUDGET?'Chế độ Reader chỉ đọc 2 MiB đầu tiên. Hình ảnh bên ngoài không được tải.':'Markdown Reader: định dạng nội dung cục bộ; ảnh ngoài không được tải để bảo vệ quyền riêng tư.')};
  }
  if(ext==='rtf'){
    return {kind:'text',name,mime:'text/plain',url:'',text:rtfText(await blob.slice(0,TEXT_BUDGET).text()),note:'Đọc phần văn bản RTF; định dạng phức tạp có thể không được tái tạo.'};
  }
  if(textExtensions.has(ext)||ext==='svg'||['text/plain','application/json'].includes(blob.type)){
    let text=await blob.slice(0,TEXT_BUDGET).text();
    if(ext==='json'||ext==='ipynb'){try{text=JSON.stringify(JSON.parse(text),null,2);}catch{/* show original */}}
    return {kind:'text',name,mime:'text/plain',url:'',text,
      note:blob.size>TEXT_BUDGET?'Chỉ xem 2 MiB đầu tiên để không làm quá tải trình duyệt.':'Hiển thị dạng văn bản thuần; nội dung HTML/SVG/script không được thực thi.'};
  }
  return binarySummary(name,blob,'Định dạng nhị phân hoặc Office cũ không có trình đọc an toàn trong trình duyệt. Chỉ hiển thị thông tin tệp; hãy tải về và mở bằng ứng dụng phù hợp.');
}
