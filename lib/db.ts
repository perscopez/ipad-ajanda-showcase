function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open("ajanda", 1)
    r.onupgradeneeded = () => r.result.createObjectStore("kv")
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}
export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await open()
  return new Promise((res, rej) => {
    const q = db.transaction("kv").objectStore("kv").get(key)
    q.onsuccess = () => res(q.result as T | undefined)
    q.onerror = () => rej(q.error)
  })
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await open()
  return new Promise((res, rej) => {
    const tx = db.transaction("kv", "readwrite")
    tx.objectStore("kv").put(value, key)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

export async function kvDel(key: string): Promise<void> {
  const db = await open()
  return new Promise((res, rej) => {
    const tx = db.transaction("kv", "readwrite")
    tx.objectStore("kv").delete(key)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

export async function kvKeys(): Promise<string[]> {
  const db = await open()
  return new Promise((res, rej) => {
    const q = db.transaction("kv").objectStore("kv").getAllKeys()
    q.onsuccess = () => res((q.result as IDBValidKey[]).map(String))
    q.onerror = () => rej(q.error)
  })
}
