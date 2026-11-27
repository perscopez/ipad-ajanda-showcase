import type { NotebookSubTab, NotebookTab, Page } from "@/lib/types"

export const TAB_COLORS = ["#cfe5ff", "#d6efcd", "#f9e3bc", "#f8d4de", "#e8dfd1", "#e0d4f5", "#fdf0a8", "#c9ecea"]

/** Sekmenin gideceği sayfa sırası (sayfa silinmişse -1). */
export function tabTarget(tab: NotebookTab | NotebookSubTab, pages: Page[]): number {
  if (tab.pageId) {
    const i = pages.findIndex((p) => p.id === tab.pageId)
    if (i >= 0) return i
  }
  if (tab.pageIndex !== undefined && tab.pageIndex >= 0 && tab.pageIndex < pages.length) return tab.pageIndex
  return -1
}
