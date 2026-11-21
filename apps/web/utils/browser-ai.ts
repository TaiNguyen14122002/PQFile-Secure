/** Optional browser-provided local foundation model (Chrome Summarizer API).
 * Never uses a remote model endpoint. Do not silently download model weights.
 * English-first while browser language coverage remains limited.
 */
type SummarizerSession={summarize:(text:string)=>Promise<string>;destroy?:()=>void};
type SummarizerFactory={availability:(options?:Record<string,unknown>)=>Promise<string>;create:(options?:Record<string,unknown>)=>Promise<SummarizerSession>};
export async function summarizeWithBrowserAI(text:string):Promise<string>{
 if(typeof window==='undefined')throw new Error('Tính năng chỉ chạy trong trình duyệt.');
 const factory=(window as typeof window & {Summarizer?:SummarizerFactory}).Summarizer;
 if(!factory)throw new Error('Trình duyệt không cung cấp Summarizer AI cục bộ. Sử dụng chế độ tóm tắt trích xuất.');
 const options={type:'key-points',format:'plain-text',length:'medium',expectedInputLanguages:['en'],outputLanguage:'en'};
 const status=await factory.availability(options);
 if(status!=='available')throw new Error(status==='downloadable'||status==='downloading'
  ?'Mô hình AI chưa có sẵn trên thiết bị. Không tự tải mô hình; hãy dùng tóm tắt trích xuất.'
  :'Trình duyệt hoặc phần cứng không hỗ trợ mô hình AI cục bộ.');
 const session=await factory.create(options);
 try{return await session.summarize(text.slice(0,18_000));}
 finally{session.destroy?.();}
}
