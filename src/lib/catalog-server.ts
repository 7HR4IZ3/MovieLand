import { ConvexHttpClient } from "convex/browser"
import { makeFunctionReference, type FunctionReference } from "convex/server"
import { fixtureCatalog, fixtureSeasons, getFixtureTitle, searchFixtures } from "./fixtures"
import type { BrowseResponse, CatalogResponse, GenreRailsResponse, MediaTitle, Season } from "./types"

type SearchResponse = { items: MediaTitle[]; page: number; source: "tmdb" | "fixture" }
export type ServerCatalogData = {
  discover?: CatalogResponse
  genres?: GenreRailsResponse
  browse?: BrowseResponse
  search?: SearchResponse
  title?: MediaTitle
  season?: Season
}

const convexUrl = (process.env.CONVEX_URL ?? import.meta.env.VITE_CONVEX_URL ?? "").trim()
const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null

async function action<T>(name: string, args: Record<string, unknown> = {}) {
  if (!convex) throw new Error("Convex is not configured")
  return convex.action(makeFunctionReference(name) as FunctionReference<"action">, args) as Promise<T>
}

async function withFallback<T>(remote: () => Promise<T>, fallback: () => T) {
  if (!convex) return fallback()
  try { return await remote() } catch { return fallback() }
}

export function getDiscover() {
  return withFallback(() => action<CatalogResponse>("catalog:discover"), () => fixtureCatalog)
}
export function getGenreRails() {
  return withFallback(() => action<GenreRailsResponse>("catalog:genreRails"), () => ({ rails: [], source: "fixture" as const }))
}
export function searchCatalog(query: string) {
  return withFallback(() => action<SearchResponse>("catalog:search", { query, page: 1 }), () => ({ items: searchFixtures(query), page: 1, source: "fixture" as const }))
}
export function getBrowse(category: string, options: { page?: number; year?: number; genreSlug?: string } = {}) {
  return withFallback(() => action<BrowseResponse>("catalog:browse", { category, ...options }), () => ({ key: category, label: category.replaceAll("-", " "), items: [], page: options.page ?? 1, totalResults: 0, totalPages: 0, year: options.year, genreSlug: options.genreSlug, source: "fixture" as const }))
}
export function getTitle(mediaType: "movie" | "tv", tmdbId: number) {
  return withFallback(() => action<MediaTitle>("catalog:getTitle", { mediaType, tmdbId }), () => getFixtureTitle(mediaType, tmdbId))
}
export function getSeason(tmdbId: number, seasonNumber: number) {
  return withFallback(() => action<Season>("catalog:getSeason", { tmdbId, seasonNumber }), () => fixtureSeasons[tmdbId])
}

export async function loadServerCatalogData(url: URL): Promise<ServerCatalogData> {
  const segments = url.pathname.split("/").filter(Boolean)
  if (url.pathname === "/") {
    const [discover, genres] = await Promise.all([getDiscover(), getGenreRails()])
    return { discover, genres }
  }
  if (url.pathname === "/search") {
    const query = url.searchParams.get("q")?.trim() ?? ""
    return query ? { search: await searchCatalog(query) } : {}
  }
  if (segments[0] === "browse" && segments.length >= 2) {
    const genreSlug = segments[1] === "genre" ? segments[2] : undefined
    const category = genreSlug ? `genre-${genreSlug}` : segments[1]
    const parsedYear = Number(url.searchParams.get("year"))
    const year = Number.isInteger(parsedYear) && parsedYear > 0 ? parsedYear : new Date().getFullYear()
    return { browse: await getBrowse(category, { page: 1, year: category === "top-250-movies" ? year : undefined, genreSlug }) }
  }
  if ((segments[0] === "movie" || segments[0] === "series") && segments.length === 2) {
    const id = Number(segments[1])
    if (!Number.isSafeInteger(id) || id <= 0) return {}
    const mediaType = segments[0] === "series" ? "tv" : "movie"
    const title = await getTitle(mediaType, id)
    return title ? { title } : {}
  }
  return {}
}
