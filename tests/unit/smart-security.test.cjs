/* Run after npm install: node tests/unit/smart-security.test.cjs */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,dependencies={}){
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const mod={exports:{}};
 new Function('require','module','exports',code)((id)=>{
  if(dependencies[id])return dependencies[id];throw Error('Unexpected dependency: '+id);
 },mod,mod.exports);
 return mod.exports;
}
const safety=load('apps/web/utils/file-safety.ts');
const intelligence=load('apps/web/utils/local-intelligence.ts',{'./security-analysis':{analyzeFile:async()=>({status:'complete',localText:'',note:''})}});
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS',name);}
const bytes=(s)=>new TextEncoder().encode(s);
test('Reject executable PE header regardless of .txt',()=>{
 assert.equal(safety.assessBytes('notes.txt',new Uint8Array([0x4d,0x5a,0,0])).status,'blocked');
});
test('Reject double extension .pdf.exe',()=>{
 assert.equal(safety.assessBytes('report.pdf.exe',bytes('placeholder')).status,'blocked');
});
test('Reject PDF extension with a ZIP header',()=>{
 assert.equal(safety.assessBytes('report.pdf',new Uint8Array([0x50,0x4b,0x03,0x04,0])).status,'blocked');
});
test('Warn when a PDF has an action trigger',()=>{
 assert.equal(safety.assessBytes('report.pdf',bytes('%PDF-1.7\n1 0 obj << /OpenAction 2 0 R >>')).status,'warning');
});
test('Unrecognized content is not marked safe',()=>{
 assert.equal(safety.assessBytes('unknown.bin',bytes('fake random payload')).status,'unverified');
});
test('Recognized PDF only passes limited static screening',()=>{
 const a=safety.assessBytes('clean.pdf',bytes('%PDF-1.5\n1 0 obj << /Type /Catalog >>'));
 assert.equal(a.status,'clear');assert.match(a.reasons[0],/KHÔNG xác nhận/);
});
test('Extract deadlines and action sentences from a local document',()=>{
 const a=intelligence.insightFromText('Dự án nghiên cứu dữ liệu nội bộ có kế hoạch hoàn thành quý này. Nhóm phụ trách cần gửi báo cáo trước 19/12/2026. Phân công các nhân viên chuẩn bị kết quả thử nghiệm.');
 assert.ok(a.deadlines.includes('19/12/2026'));assert.ok(a.actions.length>=1);assert.ok(a.summary.length>=1);
});
test('Search does not return files outside current ACL',()=>{
 const docs=[{id:'1',label:'Báo cáo',body:'kế hoạch tài chính ngân sách',status:'complete'},
  {id:'2',label:'Bí mật',body:'kế hoạch tài chính ngân sách',status:'complete'}];
 const hits=intelligence.searchDocuments(docs,'tài chính',new Set(['1']));
 assert.equal(hits.length,1);assert.equal(hits[0].id,'1');
});
test('Query expansion includes related Vietnamese concepts',()=>{
 const terms=intelligence.expandQuery('tài chính');assert.ok(terms.includes('ngan'));assert.ok(terms.includes('sach'));
});
test('Partial extraction is explicit',()=>{
 assert.equal(intelligence.insightFromText('Tài liệu có đoạn văn mô tả nhiệm vụ nghiên cứu.',true).status,'partial');
});
console.log(`Tests: ${passed}/10 passed.`);
