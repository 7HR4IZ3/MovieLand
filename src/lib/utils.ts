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
