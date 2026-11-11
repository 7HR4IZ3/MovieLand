import type { MediaTitle, MediaType } from "./types"

export type VideoServer = "vidlove" | "vidapi" | "cdnm" | "nontongo" | "111movies" | "videasy"

type EmbedOptions = {
  title: Pick<MediaTitle, "tmdbId" | "imdbId">
  mediaType: MediaType
  seasonNumber?: number
  episodeNumber?: number
}

type ServerDefinition = {
  id: VideoServer
  label: string
  /** Swatch colour used by the picker; purely cosmetic. */
  hue: string
  /** True when the embed understands MovieLand's postMessage playback bridge. */
  sync: boolean
  build: (options: EmbedOptions) => string | undefined
}

const VIDLOVE_ORIGIN = "https://player.vidlove.cc"

function imdbOrTmdb(title: EmbedOptions["title"]) {
  const imdbId = title.imdbId?.trim()
  return imdbId ? { kind: "imdb" as const, id: imdbId.startsWith("tt") ? imdbId : `tt${imdbId}` } : { kind: "tmdb" as const, id: String(title.tmdbId) }
}

function validEpisode({ seasonNumber, episodeNumber }: EmbedOptions) {
  return Number.isInteger(seasonNumber) && seasonNumber! > 0 && Number.isInteger(episodeNumber) && episodeNumber! > 0
}

function pathEmbed(origin: string, prefix: string, id: string, options: EmbedOptions) {
  const encoded = encodeURIComponent(id)
  if (options.mediaType === "movie") return `${origin}${prefix}/movie/${encoded}`
  if (!validEpisode(options)) return undefined
  return `${origin}${prefix}/tv/${encoded}/${options.seasonNumber}/${options.episodeNumber}`
}

export function buildVidLoveEmbedUrl(options: EmbedOptions) {
  const base = pathEmbed(VIDLOVE_ORIGIN, "/embed", String(options.title.tmdbId), options)
  if (!base) return undefined
  const url = new URL(base)
  url.searchParams.set("primarycolor", "e0a85b")
  url.searchParams.set("secondarycolor", "0b0b0d")
  url.searchParams.set("iconcolor", "ffffff")
  // VidLove owns its embedded download panel and the transfer it offers.
  url.searchParams.set("download", "true")
  return url.toString()
}

const SERVERS: ServerDefinition[] = [
  { id: "vidlove", label: "VidLove", hue: "#e0a85b", sync: true, build: buildVidLoveEmbedUrl },
  { id: "vidapi", label: "VidAPI", hue: "#6aa8ff", sync: false, build: (options) => pathEmbed("https://vidapi.xyz", "/embed", imdbOrTmdb(options.title).id, options) },
  {
    id: "cdnm", label: "CDNM", hue: "#58c9a1", sync: false, build: (options) => {
      const provider = imdbOrTmdb(options.title)
      const url = new URL(`https://share.cdnm.ink/embed/${provider.kind}/${encodeURIComponent(provider.id)}`)
      if (options.mediaType === "tv") {
        if (!validEpisode(options)) return undefined
        url.searchParams.set("season", String(options.seasonNumber))
        url.searchParams.set("episode", String(options.episodeNumber))
      }
      return url.toString()
    },
  },
  {
    id: "nontongo", label: "NontonGo", hue: "#c58bff", sync: false, build: (options) => {
      const provider = imdbOrTmdb(options.title)
      return pathEmbed("https://www.nontongo.win", "/embed", provider.id, options)
    },
  },
  { id: "111movies", label: "111Movies", hue: "#ff7a7a", sync: false, build: (options) => pathEmbed("https://111movies.net", "", imdbOrTmdb(options.title).id, options) },
  // Videasy documents TMDB IDs for both movie and TV player URLs.
  { id: "videasy", label: "Videasy", hue: "#f2d25c", sync: false, build: (options) => pathEmbed("https://player.videasy.net", "", String(options.title.tmdbId), options) },
]

export const DEFAULT_VIDEO_SERVER: VideoServer = "vidlove"
export const VIDEO_SERVERS: Array<{ id: VideoServer; label: string; hue: string; sync: boolean }> = SERVERS.map(({ id, label, hue, sync }) => ({ id, label, hue, sync }))

export function isVideoServer(value: string | null | undefined): value is VideoServer {
  return typeof value === "string" && SERVERS.some((server) => server.id === value)
}

export function serverLabel(id: VideoServer) {
  return SERVERS.find((server) => server.id === id)?.label ?? "Server"
}

export function buildVideoEmbedUrl(options: EmbedOptions & { server: VideoServer }) {
  const server = SERVERS.find((candidate) => candidate.id === options.server) ?? SERVERS[0]
  return server.build(options)
}

const PREFERRED_SERVER_KEY = "movieland:server"

export function getPreferredServer(): VideoServer {
  if (typeof window === "undefined") return DEFAULT_VIDEO_SERVER
  try {
    const stored = window.localStorage.getItem(PREFERRED_SERVER_KEY)
    return isVideoServer(stored) ? stored : DEFAULT_VIDEO_SERVER
  } catch { return DEFAULT_VIDEO_SERVER }
}

export function setPreferredServer(server: VideoServer) {
  if (typeof window === "undefined") return
  try { window.localStorage.setItem(PREFERRED_SERVER_KEY, server) } catch { /* Storage is optional. */ }
}

export type ProviderPlaybackCommand = {
  action: "play" | "pause"
  positionSeconds: number
  revision: number
}

/**
 * Best-effort playback bridge. Only VidLove documents a message channel, so the
 * command is targeted at its origin and skipped for every other server.
 */
export function requestProviderPlayback(iframe: HTMLIFrameElement | null, server: VideoServer, command: ProviderPlaybackCommand) {
  if (!iframe?.contentWindow || !SERVERS.find((candidate) => candidate.id === server)?.sync) return false
  iframe.contentWindow.postMessage({ source: "movieland-watchparty", ...command }, VIDLOVE_ORIGIN)
  return true
}
