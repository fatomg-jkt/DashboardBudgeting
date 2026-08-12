import 'server-only';

const getConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    const missing = [
      !url && 'NEXT_PUBLIC_SUPABASE_URL',
      !key && 'SUPABASE_SERVICE_ROLE_KEY',
    ].filter(Boolean);
    console.error(`Supabase server environment variables are missing: ${missing.join(', ')}`);
    throw new DatabaseConfigurationError();
  }

  return { url, key };
};

export class DatabaseConfigurationError extends Error {
  constructor() {
    super('Database belum dikonfigurasi.');
    this.name = 'DatabaseConfigurationError';
  }
}

export class DatabaseConnectionError extends Error {
  constructor() {
    super('Database tidak dapat dihubungi. Silakan coba kembali.');
    this.name = 'DatabaseConnectionError';
  }
}

export const isDatabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function db<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = getConfig();
  let response: Response;

  try {
    response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...init.headers,
      },
      cache: 'no-store',
    });
  } catch (error) {
    console.error('Supabase request could not be completed.', error);
    throw new DatabaseConnectionError();
  }

  if (!response.ok) {
    console.error(`Supabase request failed with HTTP ${response.status}.`);
    throw new DatabaseConnectionError();
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}
