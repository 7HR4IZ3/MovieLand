import { useCallback, useEffect, useState } from "react"
import { subscribeProviderDownloads } from "./download-service"
import type { MediaType } from "./types"
import { listNativeDownloads, subscribeNativeDownloadProgress, type NativeDownloadProgress } from "./native-download"

const LIST_KEY = "movieland:list"
const PROGRESS_KEY = "movieland:progress"
const DOWNLOADS_KEY = "movieland:downloads"

export type SavedTitle = { tmdbId: number; mediaType: MediaType }

export type DownloadStatus = "queued" | "waiting" | "downloading" | "paused" | "completed" | "failed" | "opened" | "resolving" | "processing" | "cancelled" | "ready"

export type DownloadItem = {
  id: string
  tmdbId: number
  mediaType: MediaType
  title: string
  seasonNumber?: number
  episodeNumber?: number
  episodeName?: string
  server: string
  url: string
  fileName?: string
  engine?: "native" | "server" | "browser"
  remoteId?: string
  fileUrl?: string
  progressPercent?: number
  durationSeconds?: number
  sourceType?: "embed" | "direct"
  status: DownloadStatus
  createdAt: number
  updatedAt: number
  bytesDownloaded: number
  totalBytes: number
  speedBytesPerSecond: number
  localPath?: string
  error?: string
}

function normalizeSavedTitles(value: SavedTitle[] | number[]): SavedTitle[] {
  return value.map((item) => typeof item === "number" ? { tmdbId: item, mediaType: "movie" } : item)
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { return JSON.parse(window.localStorage.getItem(key) ?? "null") ?? fallback } catch { return fallback }
}

export function useMyList() {
  const [entries, setEntries] = useState<SavedTitle[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setEntries(normalizeSavedTitles(read<SavedTitle[] | number[]>(LIST_KEY, [])))
    setLoaded(true)
  }, [])
  useEffect(() => { if (loaded) window.localStorage.setItem(LIST_KEY, JSON.stringify(entries)) }, [entries, loaded])
  const toggle = useCallback((tmdbId: number, mediaType: MediaType) => setEntries((current) => current.some((item) => item.tmdbId === tmdbId && item.mediaType === mediaType) ? current.filter((item) => !(item.tmdbId === tmdbId && item.mediaType === mediaType)) : [...current, { tmdbId, mediaType }]), [])
  return { entries, list: entries.map((item) => item.tmdbId), toggle, has: (tmdbId: number) => entries.some((item) => item.tmdbId === tmdbId) }
}

export function useProgress(tmdbId: number, episodeNumber?: number) {
  const key = `${tmdbId}:${episodeNumber ?? 0}`
  const [progress, setProgress] = useState<number>(() => read<Record<string, number>>(PROGRESS_KEY, {})[key] ?? 0)
  const save = useCallback((value: number) => {
    setProgress(value)
    const all = read<Record<string, number>>(PROGRESS_KEY, {})
    all[key] = value
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  }, [key])
  return { progress, save }
}

function makeDownloadId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeDownload(item: Partial<DownloadItem> & Pick<DownloadItem, "id" | "tmdbId" | "mediaType" | "title" | "server" | "url" | "createdAt">): DownloadItem {
  return {
    ...item,
    status: item.engine === "server" ? "failed" : item.status ?? "queued",
    ...(item.engine === "server" ? { fileUrl: undefined, error: "This local worker download is no longer available. Use VidLove’s download option, if offered." } : {}),
    updatedAt: item.updatedAt ?? item.createdAt,
    bytesDownloaded: item.bytesDownloaded ?? 0,
    totalBytes: item.totalBytes ?? 0,
    speedBytesPerSecond: item.speedBytesPerSecond ?? 0,
  }
}

function applyNativeProgress(item: DownloadItem, update: NativeDownloadProgress): DownloadItem {
  if (item.id !== update.id) return item
  return normalizeDownload({
    ...item,
    status: update.status === "finished" ? "completed" : update.status,
    bytesDownloaded: update.bytesDownloaded,
    totalBytes: update.totalBytes,
    speedBytesPerSecond: update.speedBytesPerSecond,
    localPath: update.localPath ?? item.localPath,
    error: update.error,
    updatedAt: Date.now(),
  })
}

export function useDownloads() {
  const [items, setItems] = useState<DownloadItem[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setItems(read<DownloadItem[]>(DOWNLOADS_KEY, []).map((item) => normalizeDownload(item)))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) window.localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(items))
  }, [items, loaded])

  useEffect(() => {
    let active = true
    let unsubscribe: () => void = () => undefined
    subscribeNativeDownloadProgress((update) => {
      if (!active) return
      setItems((current) => current.map((item) => applyNativeProgress(item, update)))
    }).then((cleanup) => {
      if (!active) cleanup()
      else unsubscribe = cleanup
    })
    listNativeDownloads().then((updates) => {
      if (!active || !updates.length) return
      setItems((current) => current.map((item) => {
        const update = updates.find((candidate) => candidate.id === item.id)
        return update ? applyNativeProgress(item, update) : item
      }))
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const [syncError, setSyncError] = useState("")
  useEffect(() => {
    if (!loaded) return
    return subscribeProviderDownloads(remote => {
      setSyncError("")
      setItems(current => {
        const nativeRemoteIds = new Set(current.filter(item => item.engine === "native").map(item => item.remoteId))
        const synced = remote.filter(row => !nativeRemoteIds.has(row.id)).map(row => normalizeDownload({
          id: `convex-${row.id}`, remoteId: row.id, engine: "browser", server: "VidLove",
          tmdbId: row.tmdbId, mediaType: row.mediaType, title: row.title,
          seasonNumber: row.seasonNumber, episodeNumber: row.episodeNumber,
          fileName: row.fileName, url: "", sourceType: "direct", status: row.status,
          createdAt: row.createdAt, updatedAt: row.updatedAt,
        }))
        return [...synced, ...current.filter(item => item.engine !== "browser")]
      })
    }, error => setSyncError(error.message))
  }, [loaded])

  const addDownload = useCallback((input: Omit<DownloadItem, "id" | "status" | "createdAt" | "updatedAt" | "bytesDownloaded" | "totalBytes" | "speedBytesPerSecond">) => {
    const now = Date.now()
    const item = normalizeDownload({ ...input, id: makeDownloadId(), status: input.sourceType === "direct" ? "queued" : "waiting", createdAt: now, updatedAt: now, bytesDownloaded: 0, totalBytes: 0, speedBytesPerSecond: 0 })
    setItems((current) => [item, ...current.filter((entry) => !(entry.tmdbId === item.tmdbId && entry.mediaType === item.mediaType && entry.seasonNumber === item.seasonNumber && entry.episodeNumber === item.episodeNumber && entry.engine === item.engine))])
    return item
  }, [])

  const updateDownload = useCallback((id: string, patch: Partial<DownloadItem>) => {
    setItems((current) => current.map((item) => item.id === id ? normalizeDownload({ ...item, ...patch, updatedAt: Date.now() }) : item))
  }, [])

  const markOpened = useCallback((id: string) => updateDownload(id, { status: "opened" }), [updateDownload])

  const removeDownload = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const clearDownloads = useCallback(() => setItems([]), [])

  return { items, syncError, addDownload, updateDownload, markOpened, removeDownload, clearDownloads }
}
