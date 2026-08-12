const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configured() {
  if (!url || !key) throw new Error('Database belum dikonfigurasi. Atur NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY.');
  return { url, key };
}

export async function db<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = configured();
  const response = await fetch(`${c.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: c.key,
      Authorization: `Bearer ${c.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Database gagal (${response.status}): ${await response.text()}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
