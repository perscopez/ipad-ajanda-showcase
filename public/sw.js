// Kill-switch: önceki sürümdeki çevrimdışı önbelleği temizler ve kendini kaldırır.
// (Eski dosyaların önbellekte takılıp uygulamanın açılmasını engellemesini önler.)
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) await caches.delete(k)
      await self.registration.unregister()
      const cs = await self.clients.matchAll({ type: "window" })
      cs.forEach((c) => c.navigate(c.url))
    })(),
  )
})
// Hiçbir isteği ele geçirme: her şey doğrudan ağdan gelir.
