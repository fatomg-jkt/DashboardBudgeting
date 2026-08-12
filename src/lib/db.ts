import 'server-only';
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
export class DatabaseConfigurationError extends Error {}
function configured(){if(!url||!key)throw new DatabaseConfigurationError('Supabase server environment is incomplete.');return{url,key}}
export async function db<T>(path:string,init:RequestInit={}):Promise<T>{const c=configured();const response=await fetch(`${c.url}/rest/v1/${path}`,{...init,headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,'Content-Type':'application/json',Prefer:'return=representation',...init.headers},cache:'no-store'});if(!response.ok){console.error('Supabase request failed',response.status,await response.text());throw new Error(`Supabase request failed with status ${response.status}.`)}const text=await response.text();return(text?JSON.parse(text):null)as T}
export function publicDatabaseError(error:unknown,fallback:string){return error instanceof DatabaseConfigurationError?'Database belum dikonfigurasi. Hubungi administrator untuk menyelesaikan konfigurasi penyimpanan.':fallback}
