import { callConvexAction, isConvexConfigured } from "./convex"
import { fixtureCatalog, fixtureSeasons, getFixtureTitle, searchFixtures } from "./fixtures"
import type { BrowseResponse, BrowseOptions, CatalogResponse, GenreRailsResponse, MediaTitle, Season } from "./types"

type SearchResponse = { items: MediaTitle[]; page: number; source: "tmdb" | "fixture" }

async function withFallback<T>(remote: () => Promise<T>, fallback: () => T) {
  if (!isConvexConfigured) return fallback()
  return remote()
}

export function getDiscover() {
  return withFallback<CatalogResponse>(
    () => callConvexAction<CatalogResponse>("catalog:discover"),
    () => fixtureCatalog,
  )
}

export function getGenreRails() {
  return withFallback<GenreRailsResponse>(
    () => callConvexAction<GenreRailsResponse>("catalog:genreRails"),
    () => ({ rails: [], source: "fixture" }),
  )
}

export function searchCatalog(query: string) {
  return withFallback<SearchResponse>(
    () => callConvexAction<SearchResponse>("catalog:search", { query, page: 1 }),
    () => ({ items: searchFixtures(query), page: 1, source: "fixture" }),
  )
}

export function getBrowse(category: string, options: BrowseOptions = {}) {
  return withFallback<BrowseResponse>(
    () => callConvexAction<BrowseResponse>("catalog:browse", { category, ...options }),
    () => ({ key: category, label: category.replaceAll("-", " "), items: [], page: options.page ?? 1, totalResults: 0, totalPages: 0, year: options.year, genreSlug: options.genreSlug, source: "fixture" }),
  )
}

export function getTitle(mediaType: "movie" | "tv", tmdbId: number) {
  return withFallback<MediaTitle | undefined>(
    () => callConvexAction<MediaTitle>("catalog:getTitle", { mediaType, tmdbId }),
    () => getFixtureTitle(mediaType, tmdbId),
  )
}

export function getSeason(tmdbId: number, seasonNumber: number) {
  return withFallback<Season | undefined>(
    () => callConvexAction<Season>("catalog:getSeason", { tmdbId, seasonNumber }),
    () => fixtureSeasons[tmdbId],
  )
}
