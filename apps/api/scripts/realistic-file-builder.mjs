/** Minimal, dependency-free file encoders for RESEARCH ONLY.
 * DOCX/XLSX are zipped OOXML; PDF uses basic Latin Helvetica because embedding a
 * Unicode font would require additional resources. TXT/DOCX preserve Vietnamese.
 */
import { deflateRawSync, deflateSync } from 'node:zlib';
import { linesForDocument, DATASET_V2 } from './realistic-scenarios.mjs';
const asBuffer=(s)=>Buffer.from(s,'utf8');
const escapeXml=(s)=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const crcTable=Array.from({length:256},(_,i)=>{let n=i;for(let j=0;j<8;j++)n=(n&1)?(n>>>1)^0xedb88320:(n>>>1);return n>>>0;});
const crc32=(bytes)=>{let n=0xffffffff;for(const b of bytes)n=(n>>>8)^crcTable[(n^b)&255];return (n^0xffffffff)>>>0;};
function zipParts(entries){
  let offset=0;const local=[],central=[];
  for(const {name,bytes} of entries){
    const content=Buffer.isBuffer(bytes)?bytes:asBuffer(bytes),file=asBuffer(name),packed=deflateRawSync(content),crc=crc32(content);
    const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);
    h.writeUInt32LE(crc,14);h.writeUInt32LE(packed.length,18);h.writeUInt32LE(content.length,22);h.writeUInt16LE(file.length,26);
    local.push(h,file,packed);
    const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);
    c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(content.length,24);
    c.writeUInt16LE(file.length,28);c.writeUInt32LE(offset,42);central.push(c,file);
    offset+=h.length+file.length+packed.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
  end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);
  end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
const ascii=(s)=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,c=>c==='đ'?'d':'D').replace(/[^\x20-\x7e]/g,' ');
function pdfDocument(doc){
  const lines=linesForDocument(doc).flatMap(x=>{
    const value=ascii(x).replace(/[()\\]/g,' ');
    return value.length<=91?[value]:[value.slice(0,91),`  ${value.slice(91,180)}`];
  }).slice(0,34);
  const stream=['BT /F1 10 Tf 40 780 Td 14 TL', ...lines.map((x,i)=>`${i?'T* ':''}(${x}) Tj`),'ET'].join('\n');
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}\nendstream`];
  let body='%PDF-1.4\n%Synthetic research document\n';const offsets=[];
  for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(body));body+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(body);body+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets)body+=`${String(offset).padStart(10,'0')} 00000 n \n`;
  body+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return asBuffer(body);
}
const types=String.raw`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`;
const rootRels=String.raw`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="TARGET"/></Relationships>`;
function docxDocument(doc){
  const paras=linesForDocument(doc).map((line,i)=>`<w:p><w:pPr>${i===0?'<w:pStyle w:val="Heading1"/>':''}</w:pPr><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`).join('');
  const word=`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}<w:sectPr/></w:body></w:document>`;
  return zipParts([
    {name:'[Content_Types].xml',bytes:`${types}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`},
    {name:'_rels/.rels',bytes:rootRels.replace('TARGET','word/document.xml')},
    {name:'word/document.xml',bytes:word}
  ]);
}
const values=['STT','Mã hồ sơ','Bộ phận','Ngày cập nhật','Trạng thái','Mức hoàn thành (%)','Kinh phí mô phỏng (triệu VND)'];
function sheetRows(doc){
  const row=(rowIndex,cells)=>`<row r="${rowIndex}">${cells.map((value,j)=>{
    const cellRef=`${String.fromCharCode(65+j)}${rowIndex}`;
    return typeof value==='number'?`<c r="${cellRef}"><v>${value}</v></c>`:`<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
  }).join('')}</row>`;
  const rows=[row(1,values)];
  for(let i=1;i<=27;i++)rows.push(row(i+1,[i,doc.recordCode,doc.department,doc.createdAt.slice(0,10),
    ['Đang xử lý','Chờ duyệt','Đã xử lý'][i%3],Math.max(0,Math.min(100,Math.round(doc.indicator-i/3))),doc.costMillions+(i%3)*4]));
  return rows.join('');
}
function xlsxDocument(doc){
  return zipParts([
    {name:'[Content_Types].xml',bytes:`${types}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`},
    {name:'_rels/.rels',bytes:rootRels.replace('TARGET','xl/workbook.xml')},
    {name:'xl/workbook.xml',bytes:'<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Tien do" sheetId="1" r:id="rId1"/></sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',bytes:'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'},
    {name:'xl/worksheets/sheet1.xml',bytes:`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows(doc)}</sheetData></worksheet>`}
  ]);
}
function pngDocument(doc){
  const width=480,height=240,pixels=Buffer.alloc(height*(width*4+1));
  const put=(x,y,r,g,b)=>{if(x<0||y<0||x>=width||y>=height)return;const p=y*(width*4+1)+1+x*4;pixels[p]=r;pixels[p+1]=g;pixels[p+2]=b;pixels[p+3]=255;};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)put(x,y,245,249,255);
  for(let grid=0;grid<5;grid++)for(let x=22;x<width-24;x++)put(x,30+grid*40,210,224,236);
  for(let i=0;i<10;i++){
    const x0=30+i*43,bar=25+(doc.index*11+i*17)%125;
    for(let x=x0;x<x0+27;x++)for(let y=199-bar;y<=199;y++)put(x,y,24+i*4,100+i*7,208);
  }
  const chunk=(name,bytes)=>{const type=asBuffer(name),data=Buffer.isBuffer(bytes)?bytes:asBuffer(bytes);
    const size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));
    return Buffer.concat([size,type,data,crc]);};
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),
    chunk('tEXt',asBuffer(`Description\0${doc.recordCode} - SYNTHETIC chart`)),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
function csvDocument(doc){
  const rows=[['STT','Ma ho so','Hang muc','Tien do (%)','Du toan (trieu dong)','Ngay cap nhat']];
  for(let i=1;i<=32;i++)rows.push([i,doc.recordCode,doc.category,Math.max(0,Math.min(100,Math.round(doc.indicator-i/6))),doc.costMillions+i,doc.createdAt.slice(0,10)]);
  return asBuffer('\ufeff'+rows.map(row=>row.map(x=>`"${String(x).replaceAll('"','""')}"`).join(',')).join('\r\n')+'\r\n');
}
function jsonDocument(doc){return asBuffer(JSON.stringify({synthetic:true,dataset:doc.dataset || DATASET_V2,recordCode:doc.recordCode,
  title:doc.title,department:doc.department,classification:doc.classification,deadline:doc.taskDeadlineAt,
  risk:doc.risk,tasks:[doc.action,'Rà soát quyền trước khi chia sẻ','Lưu biên bản kiểm thử'],
  metrics:Array.from({length:12},(_,i)=>({period:`M${i+1}`,progress:Math.min(100,40+(doc.index*3+i*5)%59)}))},null,2));}
export function generateFile(doc){
  const text=linesForDocument(doc).join('\n\n')+'\n';
  switch(doc.extension){
    case 'pdf':return pdfDocument(doc);
    case 'docx':return docxDocument(doc);
    case 'xlsx':return xlsxDocument(doc);
    case 'txt':return asBuffer(text);
    case 'csv':return csvDocument(doc);
    case 'json':return jsonDocument(doc);
    case 'png':return pngDocument(doc);
    case 'zip':return zipParts([{name:'README.txt',bytes:text},{name:'report.txt',bytes:text},
      {name:'meta.json',bytes:jsonDocument(doc)}]);
    default:throw new Error(`Không hỗ trợ phần mở rộng: ${doc.extension}`);
  }
}
