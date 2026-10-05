import { v } from "convex/values"

export const downloadSelection = {
  tmdbId: v.number(),
  mediaType: v.union(v.literal("movie"), v.literal("tv")),
  seasonNumber: v.optional(v.number()),
  episodeNumber: v.optional(v.number()),
}

export function downloadKey(input: { tmdbId: number; mediaType: "movie" | "tv"; seasonNumber?: number; episodeNumber?: number }) {
  if (!Number.isSafeInteger(input.tmdbId) || input.tmdbId <= 0) throw new Error("Invalid title")
  if (input.mediaType === "tv" && (!Number.isSafeInteger(input.seasonNumber) || input.seasonNumber! <= 0 || !Number.isSafeInteger(input.episodeNumber) || input.episodeNumber! <= 0)) throw new Error("Select a season and episode")
  return `${input.mediaType}:${input.tmdbId}:${input.mediaType === "tv" ? input.seasonNumber : 0}:${input.mediaType === "tv" ? input.episodeNumber : 0}:vidlove`
}

// This is a bearer capability for an anonymous device, not a claimed user ID.
// Only the digest is persisted. No endpoint returns the capability or digest.
export async function downloadOwnerHash(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid download session")
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
}

export function validateDirectFileUrl(value: string) {
  if (value.length > 8192) throw new Error("File URL is too long")
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  // Only administrators can register sources. These URLs are handed to the
  // browser directly; neither Convex nor Vercel fetches or proxies the media.
  if (url.protocol !== "https:" || url.username || url.password || url.port || !host.includes(".") || host.includes(":") || /^[\d.]+$/.test(host) || /(?:^|\.)(?:localhost|local|internal)$/.test(host)) throw new Error("Use a public HTTPS file URL")
  if (/\.(?:m3u8|mpd|html?)(?:$|\/)/i.test(url.pathname)) throw new Error("Use a video file, not a playlist or player page")
  return url.toString()
}

export function downloadFileName(value: string, contentType: "video/mp4" | "video/webm") {
  const extension = contentType === "video/mp4" ? ".mp4" : ".webm"
  const name = value.replace(/[\x00-\x1f\x7f/\\<>:"|?*]/g, "_").trim().slice(0, 180)
  if (!name || !name.toLowerCase().endsWith(extension)) throw new Error(`File name must end in ${extension}`)
  return name
}
