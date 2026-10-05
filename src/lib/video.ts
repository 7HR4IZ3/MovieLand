import type { MediaTitle, MediaType } from "./types"

// Retain legacy values in the type so existing Watchparty records still load.
// Only VidLove is selectable, and all embed URLs resolve to VidLove.
export type VideoServer = "vidlove" | "vidapi" | "cdnm" | "nontongo" | "111movies" | "videasy"
export const VIDEO_SERVERS: Array<{ id: VideoServer; label: string; description: string }> = [
  { id: "vidlove", label: "VidLove", description: "Primary" },
]

export function isVideoServer(value: string | null | undefined): value is VideoServer {
  return value === "vidlove"
}

export type ProviderPlaybackCommand = {
  action: "play" | "pause"
  positionSeconds: number
  revision: number
}

export function requestProviderPlayback(iframe: HTMLIFrameElement | null, command: ProviderPlaybackCommand) {
  if (!iframe?.contentWindow) return false
  iframe.contentWindow.postMessage({ source: "movieland-watchparty", ...command }, "https://player.vidlove.cc")
  return true
}

type EmbedOptions = {
  title: Pick<MediaTitle, "tmdbId" | "imdbId">
  mediaType: MediaType
  seasonNumber?: number
  episodeNumber?: number
}

export function buildVidLoveEmbedUrl({ title, mediaType, seasonNumber, episodeNumber }: EmbedOptions) {
  const path = mediaType === "movie"
    ? `/embed/movie/${encodeURIComponent(String(title.tmdbId))}`
    : Number.isInteger(seasonNumber) && seasonNumber! > 0 && Number.isInteger(episodeNumber) && episodeNumber! > 0
      ? `/embed/tv/${encodeURIComponent(String(title.tmdbId))}/${seasonNumber}/${episodeNumber}`
      : undefined
  if (!path) return undefined
  const url = new URL(path, "https://player.vidlove.cc")
  url.searchParams.set("primarycolor", "c98a3d")
  url.searchParams.set("secondarycolor", "181c22")
  url.searchParams.set("iconcolor", "ffffff")
  // VidLove owns its embedded download panel and the transfer it offers.
  url.searchParams.set("download", "true")
  return url.toString()
}

export function buildVideoEmbedUrl(options: EmbedOptions & { server: VideoServer }) {
  return buildVidLoveEmbedUrl(options)
}
