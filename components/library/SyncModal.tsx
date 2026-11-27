"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import {
  Check,
  Cloud,
  CloudOff,
  Copy,
  Database,
  Download,
  KeyRound,
  LogOut,
  Mail,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { getSyncLog, type SyncLog, listBackups, listDeviceStates, loadBackup, listCloudHistory, loadCloudVersion, type BackupMeta, type CloudVersion } from "@/lib/backup"
import {
  buildAuthTransferUrl,
  getSupabaseClient,
  getSupabaseConfig,
  hasEnvSupabaseConfig,
  setSupabaseConfig,
  SUPABASE_SCHEMA_SQL,
} from "@/lib/supabase"
import { cn } from "@/lib/utils"

export default function SyncModal({ onClose }: { onClose: () => void }) {
  const {
    syncStatus,
    syncError,
    userEmail,
    lastSyncedAt,
    syncNow,
    refreshAuthClient,
    signOut,
    exportBackupJson,
    importBackupJson,
    restoreData,
    reloadFromCloud,
    userId,
  } = useStore()
  const [localBk, setLocalBk] = useState<BackupMeta[]>([])
  const [cloudBk, setCloudBk] = useState<CloudVersion[] | null | undefined>(undefined)
  const [slog, setSlog] = useState<SyncLog[]>([])
  const [restoring, setRestoring] = useState<string | null>(null)
  useEffect(() => {
    void getSyncLog().then(setSlog)
    void Promise.all([listDeviceStates(), listBackups()]).then(([a, b]) => setLocalBk([...a, ...b]))
    const c = getSupabaseClient()
    if (c && userId) void listCloudHistory(c, userId).then(setCloudBk)
  }, [userId])
  const fmt = (t: number | string) => new Date(t).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
  const doRestore = async (key: string, load: () => Promise<import("@/lib/store").Data | undefined>) => {
    if (!window.confirm("Restore this version? It is merged into your current data: nothing you have now is deleted, and your current state is saved as a backup first.")) return
    setRestoring(key)
    try {
      const d = await load()
      if (!d) throw new Error("Version not found")
      await restoreData(d)
      setMsg({ type: "ok", text: "Restored. Your previous state was kept in Backups." })
      void Promise.all([listDeviceStates(), listBackups()]).then(([a, b]) => setLocalBk([...a, ...b]))
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Restore failed" })
    }
    setRestoring(null)
  }

  const existingCfg = getSupabaseConfig()
  const isEnvCfg = hasEnvSupabaseConfig()

  const [urlInput, setUrlInput] = useState(existingCfg?.url ?? "")
  const [keyInput, setKeyInput] = useState(existingCfg?.anonKey ?? "")
  const [showSetup, setShowSetup] = useState(!existingCfg)

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<null | "sql" | "link">(null)
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)
  const restoreInputRef = useRef<HTMLInputElement>(null)

  const configured = Boolean(getSupabaseConfig())
  const activeQrUrl = userEmail ? qrUrl : null

  // Build QR pairing URL when signed in
  useEffect(() => {
    if (!userEmail) return
    const client = getSupabaseClient()
    if (!client) return
    let alive = true
    client.auth.getSession().then(({ data }) => {
      if (!alive) return
      const sess = data.session
      if (sess?.access_token && sess?.refresh_token) {
        setQrUrl(buildAuthTransferUrl(sess.access_token, sess.refresh_token))
      }
    })
    return () => {
      alive = false
    }
  }, [userEmail, syncStatus])

  // Render QR onto canvas crisply
  useEffect(() => {
    if (!activeQrUrl || !qrCanvasRef.current) return
    void QRCode.toCanvas(qrCanvasRef.current, activeQrUrl, {
      width: 210,
      margin: 2,
      color: { dark: "#1c1917", light: "#ffffff" },
    })
  }, [activeQrUrl])

  const copyText = async (text: string, which: "sql" | "link") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(which)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {}
  }

  const handleSaveConfig = async () => {
    setMsg(null)
    if (!urlInput.trim().startsWith("http") || keyInput.trim().length < 20) {
      setMsg({ type: "err", text: "Enter a valid Supabase Project URL and Anon Key." })
      return
    }
    setSupabaseConfig(urlInput, keyInput)
    await refreshAuthClient()
    setShowSetup(false)
    setMsg({ type: "ok", text: "Supabase connection saved. You can sign in now." })
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    const client = getSupabaseClient()
    if (!client) {
      setShowSetup(true)
      setMsg({ type: "err", text: "Enter the Supabase URL and Anon Key first." })
      return
    }
    if (!email.trim() || password.length < 6) {
      setMsg({ type: "err", text: "Enter a valid email and a password of at least 6 characters." })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      if (authMode === "signin") {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
        if (error) setMsg({ type: "err", text: error.message })
        else setMsg({ type: "ok", text: "Signed in! Your data is syncing." })
      } else {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (error) setMsg({ type: "err", text: error.message })
        else if (data.session) setMsg({ type: "ok", text: "Account created and signed in!" })
        else setMsg({ type: "ok", text: "Verification email sent. You can sign in after confirming it." })
      }
    } finally {
      setBusy(false)
    }
  }

  const handleMagicLink = async () => {
    const client = getSupabaseClient()
    if (!client) {
      setShowSetup(true)
      setMsg({ type: "err", text: "Enter the Supabase URL and Anon Key first." })
      return
    }
    if (!email.trim()) {
      setMsg({ type: "err", text: "Enter your email address to send a magic link." })
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setMsg({ type: "err", text: error.message })
      else setMsg({ type: "ok", text: "Sign-in link sent to your email!" })
    } finally {
      setBusy(false)
    }
  }

  const handleDownloadBackup = async () => {
    let json: string
    try { json = await exportBackupJson() } catch {
      setMsg({ type: "err", text: "Could not read all files for this backup." })
      return
    }
    const blob = new Blob([json], { type: "application/json" })
    const href = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = href
    a.download = `planner-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(href), 30000)
  }

  const handleRestoreBackup = async (file?: File) => {
    if (!file) return
    if (!confirm("Restore this file and replace your current notebooks?")) return
    const ok = await file.text().then(importBackupJson).catch(() => false)
    if (ok) setMsg({ type: "ok", text: "Backup restored successfully!" })
    else setMsg({ type: "err", text: "Invalid backup file." })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-ink/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92dvh] w-full max-w-xl animate-sheet flex-col overflow-hidden rounded-t-2xl bg-paper shadow-lift sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose text-ink">
              <Cloud size={20} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-ink">Multi-device cloud sync</h2>
              <p className="text-xs text-ink-soft">Real-time sync between iPad, phone and computer</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full bg-cream-deep p-2">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 overflow-y-auto p-5">
          {/* Status Banner */}
          {(msg || syncError) && (
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 text-xs font-medium",
                msg?.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-red-200 bg-red-50 text-red-900",
              )}
            >
              {msg?.text ?? syncError}
            </div>
          )}

          {/* Signed-in View + QR Code Pairing */}
          {userEmail ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
                    {syncStatus === "offline" ? <CloudOff size={18} /> : <ShieldCheck size={20} />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-ink">{userEmail}</div>
                    <div className="text-xs text-ink-soft">
                      {syncStatus === "syncing"
                        ? "Syncing…"
                        : syncStatus === "offline"
                          ? "Offline (will sync when reconnected)"
                          : lastSyncedAt
                            ? `Last sync: ${new Date(lastSyncedAt).toLocaleTimeString("en-US")}`
                            : "Signed in on this browser"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void syncNow()}
                    className="flex items-center gap-1.5 rounded-xl bg-paper px-3 py-2 text-xs font-semibold text-ink shadow-soft active:bg-cream"
                  >
                    <RefreshCw size={14} className={syncStatus === "syncing" ? "animate-spin" : ""} /> Sync
                  </button>
                  <button
                    onClick={() => void signOut()}
                    className="flex items-center gap-1.5 rounded-xl bg-red-100 px-3 py-2 text-xs font-semibold text-red-800"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              </div>

              {/* QR Code Device Transfer */}
              <div className="rounded-2xl border border-line bg-paper p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                  <QrCode size={18} /> Sign in on another device with a QR code
                </div>
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <div className="shrink-0 overflow-hidden rounded-2xl border border-line bg-paper p-2 shadow-soft">
                    <canvas ref={qrCanvasRef} className="block" />
                  </div>
                  <div className="space-y-2.5 text-xs text-ink-soft">
                    <p className="leading-relaxed">
                      Scan this QR code with your iPad or phone camera. The browser opens and signs you in <strong>without a password</strong>, and all your notebooks sync automatically.
                    </p>
                    <p className="text-[11px] text-amber-700">
                      Note: this QR code contains your active session key, share it only with your own devices.
                    </p>
                    {activeQrUrl && (
                      <button
                        onClick={() => void copyText(activeQrUrl, "link")}
                        className="flex items-center gap-1.5 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-ink hover:bg-cream-deep"
                      >
                        {copiedKey === "link" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        {copiedKey === "link" ? "Link copied" : "Copy pairing link"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : configured ? (
            /* Sign-in / Sign-up Form */
            <form onSubmit={handleEmailAuth} className="space-y-3 rounded-2xl border border-line bg-paper p-4">
              <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-cream p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode("signin")}
                  className={cn("rounded-lg py-2 text-xs font-bold", authMode === "signin" ? "bg-paper text-ink shadow-soft" : "text-ink-soft")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("signup")}
                  className={cn("rounded-lg py-2 text-xs font-bold", authMode === "signup" ? "bg-paper text-ink shadow-soft" : "text-ink-soft")}
                >
                  Create account
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">E-posta</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-soft">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white active:bg-primary/90 disabled:opacity-50"
                >
                  <KeyRound size={16} /> {authMode === "signin" ? "Sign in" : "Sign up"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleMagicLink()}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-paper px-4 py-2.5 text-xs font-semibold text-ink active:bg-cream"
                >
                  <Mail size={15} /> Send magic link
                </button>
              </div>
              <p className="text-[11px] text-ink-soft">
                Your session stays signed in on this browser; after signing in you can create a QR code for your iPad.
              </p>
            </form>
          ) : null}

          {/* Supabase Connection Setup & Schema SQL */}
          <div className="rounded-2xl border border-line bg-paper p-4">
            <button
              type="button"
              onClick={() => setShowSetup((s) => !s)}
              className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wide text-ink"
            >
              <span className="flex items-center gap-2">
                <Database size={15} /> Supabase connection settings {configured ? "✅ Connected" : "(Setup required)"}
              </span>
              <span className="text-ink-soft/70">{showSetup ? "Hide" : "Edit"}</span>
            </button>

            {showSetup && (
              <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
                {isEnvCfg ? (
                  <p className="rounded-xl bg-cream px-3 py-2 text-xs text-ink-soft">
                    Connected automatically from environment variables (<code>NEXT_PUBLIC_SUPABASE_URL</code>).
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">Supabase Project URL</label>
                      <input
                        type="url"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://xyzcompany.supabase.co"
                        className="w-full rounded-xl border border-line px-3 py-2 text-xs outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-ink-soft">Supabase Anon Public Key</label>
                      <input
                        type="text"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        className="w-full rounded-xl border border-line px-3 py-2 text-xs font-mono outline-none focus:border-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveConfig()}
                      className="w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-white active:bg-primary/90"
                    >
                      Save connection
                    </button>
                  </>
                )}

                <div className="rounded-xl bg-ink p-3 text-stone-100">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-stone-300">
                      Run once in the Supabase SQL Editor (supabase/schema.sql):
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyText(SUPABASE_SCHEMA_SQL, "sql")}
                      className="flex items-center gap-1 rounded-lg bg-stone-700 px-2.5 py-1 text-[11px] font-semibold text-white"
                    >
                      {copiedKey === "sql" ? <Check size={12} /> : <Copy size={12} />}
                      {copiedKey === "sql" ? "Copied" : "Copy SQL"}
                    </button>
                  </div>
                  <pre className="max-h-32 overflow-auto text-[10px] leading-relaxed text-stone-300">{SUPABASE_SCHEMA_SQL}</pre>
                </div>
              </div>
            )}
          </div>

          {userEmail && (
            <div className="rounded-2xl border-2 border-primary bg-rose-soft p-4">
              <div className="text-xs font-bold text-ink">Something missing on this device?</div>
              <div className="mb-2 text-[11px] text-ink-soft">Replaces what this device shows with the exact copy stored in the cloud. Your current local data is saved as a backup first.</div>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  const r = await reloadFromCloud()
                  setMsg({ type: r.ok ? "ok" : "err", text: r.message })
                  setBusy(false)
                }}
                className="press flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                <RefreshCw size={14} /> Reload everything from the cloud
              </button>
            </div>
          )}

          {/* Version history: nothing is ever lost */}
          <div className="rounded-2xl border border-line bg-paper p-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
              <ShieldCheck size={14} /> Backups & version history
            </div>
            <div className="mb-2 text-[11px] text-ink-soft">Snapshots are saved automatically before every sync and while you work. Restoring only adds back what is in the snapshot; nothing you have now is deleted.</div>
            <div className="mb-1 text-[11px] font-semibold text-ink">On this device</div>
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {localBk.length === 0 && <div className="text-[11px] text-ink-soft">No snapshots yet.</div>}
              {localBk.map((b) => (
                <div key={b.id} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-[11px]">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-ink">{b.ts ? fmt(b.ts) : "—"}</div>
                    <div className="text-ink-soft">{b.nb} notebooks · {b.pages} pages · {b.strokes} strokes · {b.items} objects · {b.reason}</div>
                  </div>
                  <button disabled={!!restoring} onClick={() => void doRestore(b.id, () => loadBackup(b.id))} className="press rounded-lg bg-primary px-2.5 py-1.5 font-semibold text-white disabled:opacity-50">
                    {restoring === b.id ? "…" : "Restore"}
                  </button>
                </div>
              ))}
            </div>
            {userEmail && (
              <>
                <div className="mb-1 mt-3 text-[11px] font-semibold text-ink">In the cloud</div>
                {cloudBk === null && <div className="text-[11px] text-ink-soft">Cloud history is not set up yet. Copy the SQL from the setup section above, run it once in Supabase, and every version will be kept in the cloud too.</div>}
                <div className="max-h-44 space-y-1 overflow-y-auto">
                  {(cloudBk ?? []).map((v) => (
                    <div key={v.id} className="flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-[11px]">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-ink">{fmt(v.created_at)}</div>
                        <div className="text-ink-soft">{v.meta ? `${v.meta.nb} notebooks · ${v.meta.pages} pages · ${v.meta.strokes} strokes` : "—"}</div>
                      </div>
                      <button
                        disabled={!!restoring}
                        onClick={() => {
                          const c = getSupabaseClient()
                          if (c) void doRestore(`c${v.id}`, () => loadCloudVersion(c, v.id))
                        }}
                        className="press rounded-lg bg-primary px-2.5 py-1.5 font-semibold text-white disabled:opacity-50"
                      >
                        {restoring === `c${v.id}` ? "…" : "Restore"}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {slog.length > 0 && (
            <details className="rounded-2xl border border-line bg-paper p-4">
              <summary className="cursor-pointer text-xs font-bold text-ink">Sync log (for troubleshooting)</summary>
              <div className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[10px] leading-relaxed text-ink-soft">
                {slog.map((l, i) => (
                  <div key={i} className={l.shrink ? "font-bold text-red-700" : ""}>
                    {new Date(l.ts).toLocaleTimeString()} {l.source}: device {l.local.strokes}s/{l.local.pages}p · cloud {l.remote.strokes}s/{l.remote.pages}p → result {l.merged.strokes}s/{l.merged.pages}p {l.shrink ? "⚠ shrink – both sides saved to Backups" : ""}
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Local JSON Backup */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-paper p-4">
            <div>
              <div className="text-xs font-bold text-ink">Local backup</div>
              <div className="text-[11px] text-ink-soft">Download/upload notebooks, sticker packs, templates and fonts as a single file</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="flex items-center gap-1.5 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-ink hover:bg-cream-deep"
              >
                <Download size={14} /> Download backup
              </button>
              <button
                type="button"
                onClick={() => restoreInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-ink hover:bg-cream-deep"
              >
                <Upload size={14} /> Restore
              </button>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  void handleRestoreBackup(e.target.files?.[0])
                  e.target.value = ""
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
