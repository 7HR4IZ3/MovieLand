import { useCallback, useEffect, useState } from "react"
import type { MediaType } from "./types"

const LIST_KEY = "movieland:list"
const PROGRESS_KEY = "movieland:progress"

export type SavedTitle = { tmdbId: number; mediaType: MediaType }

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
