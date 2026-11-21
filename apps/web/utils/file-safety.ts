/** Static pre-upload gate. Not an antivirus scanner / sandbox. Reads at most 1 MiB. */
export type SafetyStatus='clear'|'warning'|'blocked'|'unverified';
export type SafetyResult={status:SafetyStatus;reasons:string[];detected:string;bytesChecked:number};
const executableExt=new Set(['exe','dll','scr','com','msi','bat','cmd','ps1','vbs','vbe','js','jse','wsf','sh','bash','app','apk','jar','class','py','rb']);
const expected:Record<string,string[]>={pdf:['PDF'],png:['PNG'],jpg:['JPEG'],jpeg:['JPEG'],gif:['GIF'],zip:['ZIP'],docx:['ZIP'],xlsx:['ZIP'],pptx:['ZIP'],odt:['ZIP'],ods:['ZIP'],odp:['ZIP'],webp:['WEBP']};
function kind(b:Uint8Array):string{
 const prefix=(...numbers:number[])=>numbers.every((v,i)=>b[i]===v);
 if(prefix(0x4d,0x5a))return 'PE/EXE';
 if(prefix(0x7f,0x45,0x4c,0x46))return 'ELF';
 if(prefix(0xcf,0xfa,0xed,0xfe)||prefix(0xfe,0xed,0xfa,0xcf)||prefix(0xca,0xfe,0xba,0xbe)||prefix(0xce,0xfa,0xed,0xfe)||prefix(0xfe,0xed,0xfa,0xce))return 'Mach-O';
 if(prefix(0x25,0x50,0x44,0x46,0x2d))return 'PDF';
 if(prefix(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a))return 'PNG';
 if(prefix(0xff,0xd8,0xff))return 'JPEG';
 if(prefix(0x47,0x49,0x46,0x38))return 'GIF';
 if(prefix(0x50,0x4b,0x03,0x04)||prefix(0x50,0x4b,0x05,0x06)||prefix(0x50,0x4b,0x07,0x08))return 'ZIP';
 if(prefix(0x52,0x49,0x46,0x46)&&b[8]===0x57&&b[9]===0x45&&b[10]===0x42&&b[11]===0x50)return 'WEBP';
 if(prefix(0x1f,0x8b))return 'GZIP';
 return 'Chưa xác định';
}
export function assessBytes(name:string,bytes:Uint8Array):SafetyResult{
 const lower=name.toLowerCase().trim(),ext=lower.split('.').pop()||'',detected=kind(bytes);
 const reasons:string[]=[];let status:SafetyStatus='clear';
 const escalate=(next:SafetyStatus,text:string)=>{
  const rank={clear:0,unverified:1,warning:2,blocked:3};if(rank[next]>rank[status])status=next;
  reasons.push(text);
 };
 if(executableExt.has(ext))escalate('blocked',`Phần mở rộng .${ext} có khả năng thực thi mã`);
 if(/\.(pdf|docx?|xlsx?|pptx?|png|jpe?g)\.(exe|scr|js|bat|cmd|sh|ps1)$/i.test(lower))escalate('blocked','Tên tệp có phần mở rộng kép giả mạo');
 if(['PE/EXE','ELF','Mach-O'].includes(detected))escalate('blocked',`Phát hiện chữ ký tệp thực thi ${detected}`);
 if(expected[ext]&&!expected[ext].includes(detected))escalate('blocked',`Sai chữ ký định dạng: .${ext} nhưng nội dung đầu là ${detected}`);
 if(ext==='docm'||ext==='xlsm'||ext==='pptm')escalate('blocked','Tệp Office cho phép macro: chính sách thử nghiệm chặn tải lên');
 const text=new TextDecoder('latin1').decode(bytes);
 if(detected==='PDF'&&/\/JavaScript\b|\/JS\b|\/Launch\b|\/OpenAction\b/i.test(text))escalate('warning','PDF có cấu trúc liên quan hành động/JavaScript; cần kiểm tra chuyên sâu');
 if(['docx','xlsx','pptx'].includes(ext)&&detected==='ZIP'){
  const marker=ext==='docx'?/word\/document\.xml/i:ext==='xlsx'?/xl\/workbook\.xml/i:/ppt\/presentation\.xml/i;
  if(!marker.test(text)||!text.includes('[Content_Types].xml'))escalate('warning','Chưa xác thực được cấu trúc Office Open XML, có thể là ZIP đổi đuôi hoặc ZIP đặc biệt');
 }
 if(detected==='ZIP'&&/(vbaProject\.bin|word\/vba|xl\/vba)/i.test(text))escalate('blocked','Có dấu hiệu tệp macro Office trong mục ZIP đã kiểm tra');
 if(['html','htm','svg','rtf'].includes(ext))escalate('warning',`Định dạng .${ext} có thể chứa nội dung chủ động/nhúng; cần kiểm tra thêm`);
 if(text.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))escalate('blocked','Phát hiện chuỗi thử nghiệm EICAR (không phải kết quả quét antivirus)');
 if(detected==='Chưa xác định'&&!executableExt.has(ext))escalate('unverified','Không có chữ ký định dạng nhận diện được; cần kiểm tra thủ công');
 if(status==='clear')reasons.push('Không thấy chỉ dấu trong phép kiểm tra tĩnh giới hạn; KHÔNG xác nhận tệp không có mã độc');
 return {status,reasons,detected,bytesChecked:bytes.length};
}
export async function assessFile(file:File):Promise<SafetyResult>{
 try{
  const head=new Uint8Array(await file.slice(0,1024*1024).arrayBuffer());
  if(file.size<=1024*1024)return assessBytes(file.name,head);
  // The central directory of an Office ZIP archive normally lives near EOF.
  const tail=new Uint8Array(await file.slice(Math.max(0,file.size-1024*1024)).arrayBuffer());
  const combined=new Uint8Array(head.length+tail.length);combined.set(head);combined.set(tail,head.length);
  return assessBytes(file.name,combined);
 }
 catch{return {status:'unverified',reasons:['Không đọc được dữ liệu để kiểm tra; không được coi là an toàn'],detected:'Lỗi đọc',bytesChecked:0};}
}
