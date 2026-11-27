"use client"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { kvDel, kvGet, kvSet } from "./db"

export type SupabaseConfig = {
  url: string
  anonKey: string
}

const STORAGE_KEY = "ajanda_supabase_config"
const AUTH_STORAGE_KEY = "ajanda-supabase-auth"

let cachedClient: SupabaseClient | null = null
let cachedKey = ""

export function hasEnvSupabaseConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (envUrl && envKey) {
    return { url: envUrl.replace(/\/+$/, ""), anonKey: envKey }
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SupabaseConfig>
        if (parsed.url && parsed.anonKey) {
          return { url: parsed.url.trim().replace(/\/+$/, ""), anonKey: parsed.anonKey.trim() }
        }
      }
    } catch {}
  }
  return null
}

export function setSupabaseConfig(url: string, anonKey: string) {
  if (typeof window === "undefined") return
  const cleanUrl = url.trim().replace(/\/+$/, "")
  const cleanKey = anonKey.trim()
  if (!cleanUrl || !cleanKey) {
    window.localStorage.removeItem(STORAGE_KEY)
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }))
  }
  cachedClient = null
  cachedKey = ""
}

/**
 * Oturum iki yerde saklanır (localStorage + IndexedDB). Safari bir tanesini silerse (7 gün kuralı vb.)
 * diğerinden geri yüklenir; böylece kayıtlı cihaz her seferinde yeniden giriş istemez.
 */
const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const v = window.localStorage.getItem(key)
      if (v != null) return v
    } catch {}
    try {
      const v = await kvGet<string>("auth:" + key)
      if (v) {
        try {
          window.localStorage.setItem(key, v)
        } catch {}
        return v
      }
    } catch {}
    return null
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      window.localStorage.setItem(key, value)
    } catch {}
    try {
      await kvSet("auth:" + key, value)
    } catch {}
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      window.localStorage.removeItem(key)
    } catch {}
    try {
      await kvDel("auth:" + key)
    } catch {}
  },
}

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig()
  if (!cfg) return null
  const sig = `${cfg.url}::${cfg.anonKey}`
  if (!cachedClient || cachedKey !== sig) {
    cachedClient = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
        storage: authStorage,
      },
    })
    cachedKey = sig
  }
  return cachedClient
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str)
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export function buildAuthTransferUrl(accessToken: string, refreshToken: string): string | null {
  if (typeof window === "undefined") return null
  const cfg = getSupabaseConfig()
  const payload = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    url: cfg?.url,
    anonKey: cfg?.anonKey,
  })
  const encoded = toBase64Url(payload)
  return `${window.location.origin}${window.location.pathname}#auth_transfer=${encoded}`
}

export async function consumeAuthTransferFromHash(): Promise<{ transferred: boolean; error?: string }> {
  if (typeof window === "undefined") return { transferred: false }
  const hash = window.location.hash
  if (!hash || !hash.includes("auth_transfer=")) return { transferred: false }

  const match = hash.match(/auth_transfer=([^&]+)/)
  if (!match) return { transferred: false }

  try {
    const parsed = JSON.parse(fromBase64Url(match[1])) as {
      access_token?: string
      refresh_token?: string
      url?: string
      anonKey?: string
    }
    // Strip sensitive token hash immediately from URL bar
    window.history.replaceState(null, "", window.location.pathname + window.location.search)

    if (!parsed.access_token || !parsed.refresh_token) {
      return { transferred: false, error: "QR session data is missing." }
    }

    // A transfer link signs this device into someone's account (and may point it at another backend).
    // Never apply it silently: a crafted link could otherwise make this device upload its notebooks
    // into an attacker's account or project (login CSRF / session fixation).
    const current = getSupabaseConfig()
    const linkUrl = parsed.url?.trim().replace(/\/+$/, "")
    const switchesBackend = Boolean(linkUrl && parsed.anonKey && linkUrl !== current?.url)
    if (switchesBackend) {
      if (current || !linkUrl!.startsWith("https://")) {
        return { transferred: false, error: "This sign-in link points to a different sync server and was ignored." }
      }
    }
    const target = linkUrl ? new URL(linkUrl).host : "the configured sync server"
    if (!window.confirm(`Sign in on this device with the account from the QR code?\n\nServer: ${target}\n\nOnly continue if you scanned this code from your own device.`)) {
      return { transferred: false }
    }
    if (switchesBackend) setSupabaseConfig(linkUrl!, parsed.anonKey!)

    const client = getSupabaseClient()
    if (!client) {
      return { transferred: false, error: "Supabase configuration not found." }
    }

    const { error } = await client.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    })
    if (error) return { transferred: false, error: error.message }
    return { transferred: true }
  } catch (err) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search)
    return { transferred: false, error: err instanceof Error ? err.message : "Could not transfer the session." }
  }
}

export const SUPABASE_SCHEMA_SQL = `create table if not exists public.user_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_states enable row level security;

drop policy if exists "Users can read their own planner data" on public.user_states;
create policy "Users can read their own planner data"
  on public.user_states
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own planner data" on public.user_states;
create policy "Users can insert their own planner data"
  on public.user_states
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own planner data" on public.user_states;
create policy "Users can update their own planner data"
  on public.user_states
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Realtime anlık senkronizasyon için tabloyu yayına ekle
do $$
begin
  alter publication supabase_realtime add table public.user_states;
exception
  when duplicate_object then null;
end $$;

-- Veri kaybına karşı bulut geçmişi: her birkaç dakikada bir anlık görüntü saklanır (uygulama kendisi seyreltir).
create table if not exists public.user_state_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  state jsonb not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists user_state_history_user_idx on public.user_state_history (user_id, created_at desc);
alter table public.user_state_history enable row level security;

drop policy if exists "history read own" on public.user_state_history;
create policy "history read own" on public.user_state_history for select using (auth.uid() = user_id);
drop policy if exists "history insert own" on public.user_state_history;
create policy "history insert own" on public.user_state_history for insert with check (auth.uid() = user_id);
drop policy if exists "history delete own" on public.user_state_history;
create policy "history delete own" on public.user_state_history for delete using (auth.uid() = user_id);

-- Sticker paketleri ve yüklenen fontlar için bulut yedeği (cihaz değiştirince / uygulama silinince kaybolmasın)
create table if not exists public.user_assets (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_assets enable row level security;
drop policy if exists "assets own" on public.user_assets;
create policy "assets own" on public.user_assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
`
