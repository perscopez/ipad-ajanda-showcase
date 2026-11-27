"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Library, { type Resume } from "@/components/library/Library"
import CoverView from "@/components/notebook/CoverView"
import NotebookView from "@/components/notebook/NotebookView"
import { useStore } from "@/lib/store"

type Screen = { k: "lib"; folderId: string | null } | { k: "nb"; id: string; i: number } | { k: "cover"; id: string; i: number }

const NAV_KEY = "defterim_nav"
const RESUME_KEY = "defterim_resume"
const ROOT: Screen = { k: "lib", folderId: null }

const read = <T,>(key: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") as T | null
  } catch {
    return null
  }
}

/**
 * Uygulama kabuğu: tek bir ekran yığını (stack) tutar.
 * - iPad'in kenardan geri kaydırma hareketi ve tarayıcı geri tuşu uygulama içi "Back" ile aynı şeyi yapar.
 * - Uygulama kapanıp açılınca kaldığın ekrana (klasör / defter / sayfa) döner.
 * - Ekranlar arası geçişler aynı yumuşak animasyonu kullanır.
 */
export default function App() {
  const { loaded } = useStore()
  return loaded ? <LoadedApp /> : <div role="status">Loading notebooks…</div>
}

function LoadedApp() {
  const { notebooks, folders } = useStore()
  const [stack, setStack] = useState<Screen[]>(() => {
    const saved = read<Screen>(NAV_KEY)
    if (!saved) return [ROOT]
    if (saved.k === "lib") return folders.some(f => f.id === saved.folderId) ? [ROOT, saved] : [ROOT]
    const nb = notebooks.find(n => n.id === saved.id)
    if (!nb) return [ROOT]
    return [{ k: "lib", folderId: nb.folderId }, { ...saved, i: Math.max(0, Math.min(saved.i || 0, nb.pages.length - 1)) }]
  })
  const depth = useRef(stack.length - 1)
  const top = stack[stack.length - 1]
  const resume = read<NonNullable<Resume>>(RESUME_KEY)

  const navigate = useCallback((s: Screen) => {
    history.pushState({ d: depth.current + 1 }, "")
    depth.current += 1
    setStack((st) => [...st, s])
  }, [])
  const replaceTop = useCallback((s: Screen) => setStack((st) => [...st.slice(0, -1), s]), [])
  const back = useCallback(
    (fallback: Screen) => {
      if (depth.current > 0) history.back()
      else replaceTop(fallback)
    },
    [replaceTop],
  )

  // Tarayıcı / iPad geri hareketi
  useEffect(() => {
    if (history.state?.d !== depth.current) {
      history.replaceState({ d: 0 }, "")
      if (depth.current) history.pushState({ d: depth.current }, "")
    }
    const onPop = (e: PopStateEvent) => {
      const d = (e.state as { d?: number } | null)?.d ?? 0
      if (d < depth.current) {
        depth.current = d
        setStack((st) => (st.length > 1 ? st.slice(0, st.length - 1) : st))
      }
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  // Ekranı hatırla
  useEffect(() => {
    try {
      localStorage.setItem(NAV_KEY, JSON.stringify(top))
      if (top.k === "nb") {
        const r = { nbId: top.id, i: top.i }
        localStorage.setItem(RESUME_KEY, JSON.stringify(r))
      }
    } catch {}
  }, [top])

  // Silinen bir defterde kaldıysak kitaplığa dön
  const nb = top.k === "lib" ? undefined : notebooks.find((n) => n.id === top.id)
  if (top.k !== "lib" && !nb) setStack([ROOT])

  const screenKey = top.k === "lib" ? `lib-${top.folderId ?? "root"}` : `${top.k}-${top.id}`
  let view
  if (top.k === "lib" || !nb) {
    const folderId = top.k === "lib" ? top.folderId : null
    view = (
      <Library
        folderId={folderId}
        resume={notebooks.some(n => n.id === resume?.nbId) ? resume : null}
        onFolder={(id) => {
          if (id) navigate({ k: "lib", folderId: id })
          else if (stack.length > 1 && stack[stack.length - 2].k === "lib") back(ROOT)
          else replaceTop(ROOT)
        }}
        onOpen={(id, i = 0) => navigate({ k: "nb", id, i })}
        onCover={(id) => navigate({ k: "cover", id, i: 0 })}
      />
    )
  } else if (top.k === "cover") {
    view = <CoverView nb={nb} onBack={() => back({ k: "nb", id: nb.id, i: top.i })} />
  } else {
    view = (
      <NotebookView
        nb={nb}
        index={top.i}
        setIndex={(i) => replaceTop({ k: "nb", id: nb.id, i })}
        onBack={() => back({ k: "lib", folderId: nb.folderId })}
        onCover={() => navigate({ k: "cover", id: nb.id, i: top.i })}
      />
    )
  }

  return (
    <div key={screenKey} className="h-full animate-screen">
      {view}
    </div>
  )
}
