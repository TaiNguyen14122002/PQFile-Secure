/** All browser API calls use the same user-safe error parser. Never echo HTML error pages. */
export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly errorId?: string) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function requestApi<T=any>(path:string, init:RequestInit={}):Promise<T>{
  const isForm=init.body instanceof FormData;
  const headers=new Headers(init.headers);
  if(!isForm && !headers.has('Content-Type'))headers.set('Content-Type','application/json');
  let res:Response;
  try {
    res=await fetch(`/api${path}`,{
      ...init, credentials:'include', headers
    });
  } catch {
    throw new ApiRequestError('Không thể kết nối đến máy chủ PQFile. Kiểm tra Docker và đường truyền.',0);
  }
  if(!res.ok){
    let body:unknown;
    try { body=await res.json(); } catch { body=null; }
    const payload=body&&typeof body==='object'?body as Record<string,unknown>:{};
    const errorId=typeof payload.errorId==='string'&&/^[0-9a-f-]{36}$/i.test(payload.errorId)
      ?payload.errorId:undefined;
    const raw=payload.message;
    const message=Array.isArray(raw)?raw.filter(x=>typeof x==='string').join('; ')
      :typeof raw==='string'?raw:'';
    const fallback=res.status===401?'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
      :res.status===403?'Bạn không có quyền thực hiện thao tác này.'
      :res.status===404?'Không tìm thấy tài nguyên.'
      :res.status===413?'Tệp vượt quá giới hạn tải lên.'
      :res.status===429?'Bạn thao tác quá nhanh. Vui lòng thử lại sau.'
      :res.status===502||res.status===503||res.status===504?'Dịch vụ đang gián đoạn. Kiểm tra trạng thái API hoặc kho lưu trữ.'
      :res.status>=500?'Máy chủ gặp sự cố. Kiểm tra nhật ký API.':`Yêu cầu thất bại (HTTP ${res.status}).`;
    // Only return server messages from JSON; ignore proxy HTML error bodies.
    throw new ApiRequestError(`${message||fallback}${errorId?` (mã lỗi: ${errorId})`:''}`,res.status,errorId);
  }
  if(res.status===204)return undefined as T;
  const contentType=res.headers.get('content-type')||'';
  if(!contentType.includes('application/json'))
    throw new ApiRequestError('API trả về dữ liệu không đúng định dạng JSON. Kiểm tra cấu hình gateway.',res.status);
  try {return await res.json() as T;}
  catch {throw new ApiRequestError('Không thể đọc phản hồi JSON từ máy chủ.',res.status);}
}
import {setUnlockedVault} from '~/utils/vault-session';
export function useAuth(){
 const user=useState<{id:string,email:string,displayName:string,role:string}|null>('pq-user',()=>null);
 const loaded=useState('pq-auth-loaded',()=>false);
 const load=async()=>{const previous=user.value?.id;try{const r=await requestApi<{user:typeof user.value}>('/auth/me');if(previous && r.user?.id!==previous)setUnlockedVault(null);user.value=r.user;}catch{setUnlockedVault(null);user.value=null;}loaded.value=true;};
 const logout=async()=>{await requestApi('/auth/logout',{method:'POST'}).catch(()=>{});setUnlockedVault(null);user.value=null;loaded.value=true;return navigateTo('/login');};
 return {user,loaded,load,logout};
}
