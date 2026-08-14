import { useCallback, useEffect, useState } from "react"
import type { MediaType } from "./types"

const LIST_KEY = "movieland:list"
const PROGRESS_KEY = "movieland:progress"
const DOWNLOADS_KEY = "movieland:downloads"

export type SavedTitle = { tmdbId: number; mediaType: MediaType }

export type DownloadStatus = "queued" | "opened"

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
  status: DownloadStatus
  createdAt: number
}

function normalizeSavedTitles(value: SavedTitle[] | number[]): SavedTitle[] {
  return value.map((item) => typeof item === "number" ? { tmdbId: item, mediaType: "movie" } : item)
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback
  try { return JSON.parse(window.localStorage.getItem(key) ?? "null") ?? fallback } catch { return fallback }
}

export function useMyList() {
  const [entries, setEntries] = useState<SavedTitle[]>(() => normalizeSavedTitles(read<SavedTitle[] | number[]>(LIST_KEY, [])))
  useEffect(() => { window.localStorage.setItem(LIST_KEY, JSON.stringify(entries)) }, [entries])
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

export function useDownloads() {
  const [items, setItems] = useState<DownloadItem[]>(() => read<DownloadItem[]>(DOWNLOADS_KEY, []))

  useEffect(() => {
    window.localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(items))
  }, [items])

  const addDownload = useCallback((input: Omit<DownloadItem, "id" | "status" | "createdAt">) => {
    const item: DownloadItem = { ...input, id: makeDownloadId(), status: "queued", createdAt: Date.now() }
    setItems((current) => [item, ...current.filter((entry) => entry.url !== item.url)])
    return item
  }, [])

  const markOpened = useCallback((id: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, status: "opened" } : item))
  }, [])

  const removeDownload = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const clearDownloads = useCallback(() => setItems([]), [])

  return { items, addDownload, markOpened, removeDownload, clearDownloads }
}
