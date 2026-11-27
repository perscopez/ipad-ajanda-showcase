"use client"

/** Beklenmeyen bir hata olursa beyaz ekran yerine kurtarma seçenekleri gösterir. Veriler silinmez. */
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid h-dvh place-items-center bg-cream p-6 text-center">
      <div className="max-w-sm space-y-4">
        <h1 className="font-serif text-2xl font-semibold text-ink">Something went wrong</h1>
        <p className="text-sm text-ink-soft">Your notebooks are safe: nothing was deleted. Try again, or clear the cached app files and reload.</p>
        <p className="break-words text-[11px] text-ink-soft/70">{error.message}</p>
        <div className="flex flex-col gap-2">
          <button onClick={reset} className="rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white">
            Try again
          </button>
          <button
            onClick={async () => {
              try {
                if ("serviceWorker" in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
                if ("caches" in window) for (const k of await caches.keys()) await caches.delete(k)
              } catch {}
              location.reload()
            }}
            className="rounded-2xl bg-cream-deep px-4 py-3 text-sm font-semibold text-ink"
          >
            Clear cached files and reload
          </button>
        </div>
      </div>
    </div>
  )
}
