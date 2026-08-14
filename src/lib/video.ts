import type { MediaTitle, MediaType } from "./types"

const VID_API_ORIGIN = "https://vidapi.xyz"
const CDNM_ORIGIN = "https://share.cdnm.ink"
const NONTONGO_ORIGIN = "https://www.nontongo.win"

export type VideoServer = "vidapi" | "cdnm" | "nontongo"

export type ProviderPlaybackCommand = {
  action: "play" | "pause"
  positionSeconds: number
  revision: number
}

export const VIDEO_SERVERS: Array<{ id: VideoServer; label: string; description: string }> = [
  { id: "vidapi", label: "VidAPI", description: "Primary" },
  { id: "cdnm", label: "CDNM", description: "Alternative" },
  { id: "nontongo", label: "NontonGo", description: "Alternative" },
]

/**
 * Provider adapter boundary for cross-origin players. Current embeds do not
 * document a playback bridge, so this sends a namespaced best-effort message
 * while the room state remains authoritative in Convex.
 */
export function requestProviderPlayback(iframe: HTMLIFrameElement | null, command: ProviderPlaybackCommand) {
  if (!iframe?.contentWindow) return false
  iframe.contentWindow.postMessage({ source: "movieland-watchparty", ...command }, "*")
  return true
}

function providerId(title: Pick<MediaTitle, "tmdbId" | "imdbId">) {
  const imdbId = title.imdbId?.trim()
  if (imdbId) return imdbId.startsWith("tt") ? imdbId : `tt${imdbId}`
  return String(title.tmdbId)
}

function externalProvider(title: Pick<MediaTitle, "tmdbId" | "imdbId">) {
  const imdbId = title.imdbId?.trim()
  return imdbId ? { kind: "imdb", id: imdbId.startsWith("tt") ? imdbId : `tt${imdbId}` } : { kind: "tmdb", id: String(title.tmdbId) }
}

export function buildVidApiEmbedUrl({
  title,
  mediaType,
  seasonNumber,
  episodeNumber,
}: {
  title: Pick<MediaTitle, "tmdbId" | "imdbId">
  mediaType: MediaType
  seasonNumber?: number
  episodeNumber?: number
}) {
  const id = encodeURIComponent(providerId(title))

  if (mediaType === "movie") {
    return `${VID_API_ORIGIN}/embed/movie/${id}`
  }

  if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) {
    return undefined
  }

  return `${VID_API_ORIGIN}/embed/tv/${id}/${seasonNumber}/${episodeNumber}`
}

export function buildCdnmEmbedUrl({
  title,
  mediaType,
  seasonNumber,
  episodeNumber,
}: {
  title: Pick<MediaTitle, "tmdbId" | "imdbId">
  mediaType: MediaType
  seasonNumber?: number
  episodeNumber?: number
}) {
  const provider = externalProvider(title)
  const url = new URL(`${CDNM_ORIGIN}/embed/${provider.kind}/${encodeURIComponent(provider.id)}`)
  if (mediaType === "tv") {
    if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) return undefined
    url.searchParams.set("season", String(seasonNumber))
    url.searchParams.set("episode", String(episodeNumber))
  }
  return url.toString()
}

export function buildNontonGoEmbedUrl({
  title,
  mediaType,
  seasonNumber,
  episodeNumber,
}: {
  title: Pick<MediaTitle, "tmdbId" | "imdbId">
  mediaType: MediaType
  seasonNumber?: number
  episodeNumber?: number
}) {
  const provider = externalProvider(title)
  const url = new URL(`${NONTONGO_ORIGIN}/embed/${mediaType === "tv" ? "tv" : "movie"}/${encodeURIComponent(provider.id)}`)
  if (mediaType === "tv") {
    if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) return undefined
    url.pathname += `/${seasonNumber}/${episodeNumber}`
  }
  return url.toString()
}

export function buildVideoEmbedUrl({
  server,
  title,
  mediaType,
  seasonNumber,
  episodeNumber,
}: {
  server: VideoServer
  title: Pick<MediaTitle, "tmdbId" | "imdbId">
  mediaType: MediaType
  seasonNumber?: number
  episodeNumber?: number
}) {
  if (server === "cdnm") return buildCdnmEmbedUrl({ title, mediaType, seasonNumber, episodeNumber })
  if (server === "nontongo") return buildNontonGoEmbedUrl({ title, mediaType, seasonNumber, episodeNumber })
  return buildVidApiEmbedUrl({ title, mediaType, seasonNumber, episodeNumber })
}
