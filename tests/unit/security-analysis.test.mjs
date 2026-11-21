// node --experimental-strip-types --test tests/unit/security-analysis.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeText,analyzeFile,canRedact,redactedCopy,cryptoRecommendation,shareRisk} from '../../apps/web/utils/security-analysis.ts';

test('PII detection keeps values masked in UI findings',()=>{
 const sample='CCCD 012345678901, số điện thoại 0912345678; email a.person@example.com. STK: 1234567890123';
 const result=analyzeText(sample);
 assert.ok(result.pii.some(x=>x.kind==='CCCD (dạng số)'));
 assert.ok(result.pii.some(x=>x.kind==='Điện thoại'));
 assert.ok(result.pii.some(x=>x.kind==='Email cá nhân'));
 assert.ok(result.pii.some(x=>x.kind==='Tài khoản tài chính'));
 assert.ok(result.pii.every(x=>!x.masked.includes('012345678901')));
 assert.equal(result.suggestion,'Mật');
});

test('high-risk share with sensitive content and unlimited time requires review',()=>{
 const r=shareRisk({classification:'Tối mật',recipients:4,days:null,alerts:2,scanStatus:'complete',isNewRecipient:true});
 assert.equal(r.level,'Nghiêm trọng');
 assert.ok(r.score>=80);
 assert.ok(r.actions.some(x=>x.includes('thời hạn')));
});

test('public classification, one recipient, 1-day grant is not automatically high risk',()=>{
 const r=shareRisk({classification:'Công khai',recipients:1,days:1,alerts:0,scanStatus:'complete',isNewRecipient:true});
 assert.equal(r.level,'Thấp');
});

test('local redaction creates independent copy without changing original',async()=>{
 const original=new File(['Dữ liệu cá nhân: 012345678901; 0912345678'], 'danh-sach.txt',{type:'text/plain'});
 const scan=await analyzeFile(original);
 assert.equal(scan.status,'complete');
 assert.equal(canRedact(original.name,scan),true);
 const copy=redactedCopy(original,scan);
 assert.ok(copy.name.includes('-da-an.txt'));
 assert.equal((await original.text()).includes('012345678901'),true);
 assert.equal((await copy.text()).includes('012345678901'),false);
 assert.equal((await copy.text()).includes('[ĐÃ ẨN]'),true);
});

test('PDF without parser and DOCX with invalid ZIP require manual class choice',async()=>{
 const pdf=await analyzeFile(new File(['%PDF-1.4'], 'scan.pdf',{type:'application/pdf'}));
 assert.equal(pdf.status,'unsupported');
 const word=await analyzeFile(new File(['not a zip'], 'report.docx'));
 assert.equal(word.status,'unsupported');
});

test('crypto suggestions only recommend and do not mutate key vault',()=>{
 assert.equal(cryptoRecommendation('Công khai',100).kem,'ML-KEM-512');
 assert.equal(cryptoRecommendation('Nội bộ',100).kem,'ML-KEM-768');
 assert.equal(cryptoRecommendation('Mật',100).kem,'ML-KEM-768');
 assert.equal(cryptoRecommendation('Tối mật',100).kem,'ML-KEM-1024');
});

test('text scan truncates large files and indicates partial coverage',async()=>{
 const huge=new File([new Uint8Array(2*1024*1024+1)],'huge.txt',{type:'text/plain'});
 const r=await analyzeFile(huge);
 assert.equal(r.status,'partial');
 assert.equal(r.originalSize,huge.size);
});
