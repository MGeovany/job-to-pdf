type StoredResume = {
  name: string
  type: string
  data: ArrayBuffer
  savedAt: number
}

const RESUME_DB = "job-to-pdf"
const RESUME_STORE = "files"
const RESUME_KEY = "resume"

function openResumeDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(RESUME_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(RESUME_STORE)) {
        db.createObjectStore(RESUME_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function readStoredResume(): Promise<File | null> {
  const db = await openResumeDb()
  const stored = await new Promise<StoredResume | null>((resolve, reject) => {
    const tx = db.transaction(RESUME_STORE, "readonly")
    const store = tx.objectStore(RESUME_STORE)
    const req = store.get(RESUME_KEY)
    req.onsuccess = () => resolve((req.result as StoredResume) ?? null)
    req.onerror = () => reject(req.error)
  })

  if (!stored) return null
  return new File([stored.data], stored.name, { type: stored.type })
}

export async function writeStoredResume(file: File) {
  const db = await openResumeDb()
  const data = await file.arrayBuffer()
  const value: StoredResume = {
    name: file.name || "resume.pdf",
    type: file.type || "application/pdf",
    data,
    savedAt: Date.now(),
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RESUME_STORE, "readwrite")
    const store = tx.objectStore(RESUME_STORE)
    const req = store.put(value, RESUME_KEY)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function deleteStoredResume() {
  const db = await openResumeDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(RESUME_STORE, "readwrite")
    const store = tx.objectStore(RESUME_STORE)
    const req = store.delete(RESUME_KEY)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
