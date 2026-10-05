import type { MediaTitle, MediaType } from "./types"

const VID_API_ORIGIN = "https://vidapi.xyz"
const CDNM_ORIGIN = "https://share.cdnm.ink"
const NONTONGO_ORIGIN = "https://www.nontongo.win"
const VIDLOVE_ORIGIN = "https://player.vidlove.cc"
const ONEONE_MOVIES_ORIGIN = "https://111movies.net"
const VIDEASY_PLAYER_ORIGIN = "https://player.videasy.net"

export type VideoServer = "vidlove" | "vidapi" | "cdnm" | "nontongo" | "111movies" | "videasy"

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
  { id: "111movies", label: "111Movies", description: "Alternative" },
  { id: "videasy", label: "Videasy", description: "Alternative" },
]

export function isVideoServer(value: string | null | undefined): value is VideoServer {
  return value !== null && value !== undefined && VIDEO_SERVERS.some((option) => option.id === value)
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
  // VidLove hides its own download panel unless this documented option is on.
  // The provider still owns the actual source selection and transfer.
  url.searchParams.set("download", "true")
  return url.toString()
}

/**
 * Embed providers expose player pages, not the underlying media file. Keep
 * this adapter explicit so a provider can later return a direct file URL
 * without making the download manager accidentally save HTML as a movie.
 */
export function directMediaUrlFromEmbed(embedUrl?: string) {
  if (!embedUrl) return undefined
  try {
    const url = new URL(embedUrl)
    const candidate = url.searchParams.get("downloadUrl") ?? url.searchParams.get("file")
    if (!candidate || !/^https?:\/\//i.test(candidate)) return undefined
    return candidate
  } catch {
    return undefined
  }
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

export function build111MoviesEmbedUrl({
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
  if (mediaType === "movie") {
    return `${ONEONE_MOVIES_ORIGIN}/movie/${encodeURIComponent(provider.id)}`
  }

  if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) return undefined
  return `${ONEONE_MOVIES_ORIGIN}/tv/${encodeURIComponent(provider.id)}/${seasonNumber}/${episodeNumber}`
}

export function buildVideasyEmbedUrl({
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
  // Videasy documents TMDB IDs for both movie and TV player URLs.
  const id = encodeURIComponent(String(title.tmdbId))
  if (mediaType === "movie") {
    return `${VIDEASY_PLAYER_ORIGIN}/movie/${id}`
  }

  if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber)) return undefined
  return `${VIDEASY_PLAYER_ORIGIN}/tv/${id}/${seasonNumber}/${episodeNumber}`
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
  if (server === "111movies") return build111MoviesEmbedUrl({ title, mediaType, seasonNumber, episodeNumber })
  if (server === "videasy") return buildVideasyEmbedUrl({ title, mediaType, seasonNumber, episodeNumber })
  return buildVidApiEmbedUrl({ title, mediaType, seasonNumber, episodeNumber })
}
