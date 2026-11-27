"use client"

import { useEffect } from "react"

/** Eski çevrimdışı servis çalışanını ve önbelleğini temizler (uygulama açılmama sorununu önlemek için). */
export default function RegisterSW() {
  useEffect(() => {
    void (async () => {
      try {
        if ("serviceWorker" in navigator) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
        if ("caches" in window) for (const k of await caches.keys()) await caches.delete(k)
      } catch {}
    })()
  }, [])
  return null
}
