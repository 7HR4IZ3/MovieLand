import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function tmdbImageUrl(path: string | undefined, size: "w342" | "w500" | "w780" | "original" = "w500") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined
}

export function formatRuntime(runtime?: number) {
  if (!runtime) return "—"
  const hours = Math.floor(runtime / 60)
  const minutes = runtime % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

export function formatYear(date?: string) {
  return date ? new Intl.DateTimeFormat("en", { year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "—"
}

export function positiveParam(value: string | null, fallback: number) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
}

export function downloadFileName(title: string, mediaType: "movie" | "tv", seasonNumber?: number, episodeNumber?: number) {
  const suffix = mediaType === "tv" ? ` S${String(seasonNumber ?? 1).padStart(2, "0")}E${String(episodeNumber ?? 1).padStart(2, "0")}` : ""
  return `${title}${suffix}.mp4`.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim()
}
