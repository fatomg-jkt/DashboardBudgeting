import 'server-only';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type SupabaseStatus = 'unconfigured' | 'ready';

export function getSupabaseStatus(): SupabaseStatus {
  return url && serviceRoleKey ? 'ready' : 'unconfigured';
}

export async function supabaseAdminRequest<T>(
  resource: string,
  init: RequestInit = {},
): Promise<T> {
  if (!url || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const response = await fetch(`${url}/rest/v1/${resource}`, {
    ...init,
    cache: 'no-store',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    console.error(`Supabase request failed with status ${response.status}.`);
    throw new Error('SUPABASE_REQUEST_FAILED');
  }

  if (response.status === 204) return undefined as T;
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}
