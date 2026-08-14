import type { MediaTitle, MediaType } from "./types"

const VID_API_ORIGIN = "https://vidapi.xyz"
const CDNM_ORIGIN = "https://share.cdnm.ink"
const NONTONGO_ORIGIN = "https://www.nontongo.win"
const VIDLOVE_ORIGIN = "https://player.vidlove.cc"

export type VideoServer = "vidlove" | "vidapi" | "cdnm" | "nontongo"

export type ProviderPlaybackCommand = {
  action: "play" | "pause"
  positionSeconds: number
  revision: number
}

export const VIDEO_SERVERS: Array<{ id: VideoServer; label: string; description: string }> = [
  { id: "vidlove", label: "VidLove", description: "Primary" },
  { id: "vidapi", label: "VidAPI", description: "Alternative" },
  { id: "cdnm", label: "CDNM", description: "Alternative" },
  { id: "nontongo", label: "NontonGo", description: "Alternative" },
]

export function supportsProviderSeek(server: VideoServer) {
  return server === "vidlove"
}

/**
 * VidLove's current embedded player accepts a seek postMessage bridge. Other
 * providers remain provider-controlled because their embeds do not publish a
 * compatible control API.
 */
export function requestProviderSeek(iframe: HTMLIFrameElement | null, server: VideoServer, deltaSeconds: number, currentTime = 0) {
  if (!iframe?.contentWindow || !supportsProviderSeek(server) || !Number.isFinite(deltaSeconds)) return false
  const targetTime = Math.max(0, currentTime + deltaSeconds)
  iframe.contentWindow.postMessage({ type: "SET_TIME", time: targetTime, currentTime: targetTime, source: "movieland-controls" }, VIDLOVE_ORIGIN)
  iframe.contentWindow.postMessage({ type: "seek", seekBy: deltaSeconds, source: "movieland-controls" }, VIDLOVE_ORIGIN)
  return true
}

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

export function buildVidLoveEmbedUrl({
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
  const path = mediaType === "movie"
    ? `/embed/movie/${encodeURIComponent(String(title.tmdbId))}`
    : Number.isInteger(seasonNumber) && Number.isInteger(episodeNumber)
      ? `/embed/tv/${encodeURIComponent(String(title.tmdbId))}/${seasonNumber}/${episodeNumber}`
      : undefined

  if (!path) return undefined

  const url = new URL(`${VIDLOVE_ORIGIN}${path}`)
  url.searchParams.set("primarycolor", "c98a3d")
  url.searchParams.set("secondarycolor", "181c22")
  url.searchParams.set("iconcolor", "ffffff")
  url.searchParams.set("download", "true")
  return url.toString()
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
  if (server === "vidlove") return buildVidLoveEmbedUrl({ title, mediaType, seasonNumber, episodeNumber })
  if (server === "cdnm") return buildCdnmEmbedUrl({ title, mediaType, seasonNumber, episodeNumber })
  if (server === "nontongo") return buildNontonGoEmbedUrl({ title, mediaType, seasonNumber, episodeNumber })
  return buildVidApiEmbedUrl({ title, mediaType, seasonNumber, episodeNumber })
}
