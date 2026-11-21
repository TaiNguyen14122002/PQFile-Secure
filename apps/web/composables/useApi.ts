import { ApiRequestError, parseApiResponse } from '~/utils/api-response';
export { ApiRequestError } from '~/utils/api-response';

/** Browser requests always go through the same-origin /api/ gateway. */
export async function requestApi<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const headers = new Headers(init.headers);
  if (!isForm && init.body != null && !headers.has('Content-Type'))
    headers.set('Content-Type', 'application/json');
  // Ask explicitly for JSON; avoid gateways serving an HTML page for an API GET.
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, credentials: 'include', headers, cache: 'no-store' });
  } catch {
    throw new ApiRequestError('Không thể kết nối đến máy chủ PQFile. Kiểm tra Docker và Gateway.', 0);
  }
  return parseApiResponse<T>(res, path);
}

import { setUnlockedVault } from '~/utils/vault-session';
export function useAuth() {
  const user = useState<{id:string,email:string,displayName:string,role:string}|null>('pq-user', () => null);
  const loaded = useState('pq-auth-loaded', () => false);
  const load = async () => {
    const previous = user.value?.id;
    try {
      const r = await requestApi<{user: typeof user.value}>('/auth/me');
      if (previous && r.user?.id !== previous) setUnlockedVault(null);
      user.value = r.user;
    } catch {
      setUnlockedVault(null);
      user.value = null;
    }
    loaded.value = true;
  };
  const logout = async () => {
    await requestApi('/auth/logout', {method:'POST'}).catch(() => {});
    setUnlockedVault(null);
    user.value = null;
    loaded.value = true;
    return navigateTo('/login');
  };
  return {user, loaded, load, logout};
}
