import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import { convexClient, convexReactClient } from "./convex"

export type DownloadHistoryItem = FunctionReturnType<typeof api.downloads.list>[number]
export type DownloadSelection = { tmdbId: number; mediaType: "movie" | "tv"; seasonNumber?: number; episodeNumber?: number }
const SESSION_KEY = "movieland:download-session"

function client() {
  if (!convexClient) throw new Error("Downloads are unavailable. Convex is not configured.")
  return convexClient
}

function ownerToken() {
  if (typeof window === "undefined") throw new Error("Downloads require a browser")
  try {
    const existing = window.localStorage.getItem(SESSION_KEY)
    if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, "0")).join("")
    window.localStorage.setItem(SESSION_KEY, token)
    return token
  } catch { throw new Error("Allow site storage to keep your download history private.") }
}

export async function requestProviderDownload(selection: DownloadSelection) {
  const result = await client().mutation(api.downloads.request, { ...selection, ownerToken: ownerToken() })
  if (!result.available) throw new Error(result.reason)
  return result.item
}

export async function openProviderDownload(id: string) {
  const result = await client().mutation(api.downloads.open, { id: id as Id<"downloadHistory">, ownerToken: ownerToken() })
  if (!result.available) throw new Error(result.reason)
  return result
}

export function removeProviderDownload(id: string) {
  return client().mutation(api.downloads.remove, { id: id as Id<"downloadHistory">, ownerToken: ownerToken() })
}

export function clearProviderDownloads() {
  return client().mutation(api.downloads.clear, { ownerToken: ownerToken() })
}

export function subscribeProviderDownloads(onChange: (items: DownloadHistoryItem[]) => void, onError: (error: Error) => void) {
  if (!convexReactClient) return () => undefined
  try {
    const watch = convexReactClient.watchQuery(api.downloads.list, { ownerToken: ownerToken() })
    const refresh = () => {
      try {
        const rows = watch.localQueryResult()
        if (rows) onChange(rows)
      } catch (error) { onError(error instanceof Error ? error : new Error(String(error))) }
    }
    const unsubscribe = watch.onUpdate(refresh)
    refresh()
    return unsubscribe
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)))
    return () => undefined
  }
}
