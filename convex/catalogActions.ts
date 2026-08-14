import { fetchDiscover, fetchExternalIds, fetchGenre, fetchGenres, fetchNowPlayingMovies, fetchOnTheAirSeries, fetchPopular, fetchRecent, fetchSearch, fetchSeason, fetchTitle, fetchTop250Movies, fetchTopRated, fetchTrending, type TmdbGenre, type TmdbPagedListResponse } from "./lib/tmdb"
import { normalizeEpisode, normalizeListItem, normalizeTitle, type NormalizedEpisode, type NormalizedTitle } from "./lib/normalize"

export const CACHE_TTL_MS = 1000 * 60 * 30
export const RECENT_WINDOW_DAYS = 90
export const TOP_250_PAGE_SIZE = 20
export const TOP_250_MAX_RESULTS = 250

function isNormalizedTitle(input: NormalizedTitle | null): input is NormalizedTitle {
  return input !== null
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function currentYear() {
  return new Date().getUTCFullYear()
}

export function recentWindow() {
  const end = new Date()
  const start = new Date(end.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  return { from: dateOnly(start), to: dateOnly(end), key: `${dateOnly(start)}:${dateOnly(end)}` }
}

export function genreSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function cacheKey(kind: string, value: string) {
  return `${kind}:${value.trim().toLowerCase()}`
}

export type DiscoverRail = {
  key: string
  label: string
  items: NormalizedTitle[]
  href: string
}

export type DiscoverPayload = {
  rails: DiscoverRail[]
  page: number
  source: "tmdb"
  year: number
}

export type GenreRail = {
  key: string
  slug: string
  label: string
  items: NormalizedTitle[]
  href: string
}

export type GenreRailsPayload = {
  rails: GenreRail[]
  source: "tmdb"
}

export type SearchPayload = {
  items: NormalizedTitle[]
  page: number
  source: "tmdb"
}

export type BrowseOptions = {
  page?: number
  year?: number
  genreSlug?: string
}

export type BrowsePayload = {
  key: string
  label: string
  items: NormalizedTitle[]
  page: number
  totalResults: number
  totalPages: number
  year?: number
  genreSlug?: string
  source: "tmdb"
}

export type SeasonPayload = {
  tmdbId: number
  seasonNumber: number
  name: string
  overview: string
  episodeCount: number
  episodes: NormalizedEpisode[]
}

export type StoredSeasonPayload = SeasonPayload & { updatedAt: number }

function normalizePage(response: TmdbPagedListResponse, mediaType?: "movie" | "tv") {
  return response.results
    .map((item) => normalizeListItem(mediaType ? { ...item, media_type: mediaType } : item))
    .filter(isNormalizedTitle)
}

function totalResults(response: TmdbPagedListResponse, fallback: number) {
  return response.total_results ?? fallback
}

function totalPages(response: TmdbPagedListResponse, fallback: number) {
  return response.total_pages ?? fallback
}

function rail(key: string, label: string, items: NormalizedTitle[], href = `/browse/${key}`): DiscoverRail {
  return { key, label, items, href }
}

async function resolveTop250VoteFloor(year: number) {
  const floors = [500, 100, 25, 0]
  for (const floor of floors) {
    const result = await fetchTop250Movies(year, floor, 1)
    if ((result.total_results ?? result.results.length) >= TOP_250_MAX_RESULTS || floor === 0) return floor
  }
  return 0
}

async function loadTop250Page(year: number, page: number, voteFloor?: number) {
  const floor = voteFloor ?? await resolveTop250VoteFloor(year)
  const response = await fetchTop250Movies(year, floor, page)
  const total = Math.min(totalResults(response, response.results.length), TOP_250_MAX_RESULTS)
  const pages = Math.min(Math.ceil(total / TOP_250_PAGE_SIZE), Math.ceil(TOP_250_MAX_RESULTS / TOP_250_PAGE_SIZE))
  return {
    floor,
    response,
    items: normalizePage(response, "movie").slice(0, TOP_250_PAGE_SIZE),
    totalResults: total,
    totalPages: pages || 1,
  }
}

function mergeGenreResults(movieResponse: TmdbPagedListResponse, tvResponse: TmdbPagedListResponse) {
  const combined: Array<Record<string, unknown>> = [
    ...movieResponse.results.map((item) => ({ ...item, media_type: "movie" })),
    ...tvResponse.results.map((item) => ({ ...item, media_type: "tv" })),
  ]
  return combined
    .sort((left, right) => Number(right.popularity ?? 0) - Number(left.popularity ?? 0))
    .map(normalizeListItem)
    .filter(isNormalizedTitle)
    .slice(0, TOP_250_PAGE_SIZE)
}

function mergeGenres(movieGenres: TmdbGenre[], tvGenres: TmdbGenre[]) {
  const merged = new Map<string, { slug: string; name: string; movieId?: number; tvId?: number }>()
  movieGenres.forEach((genre) => {
    const slug = genreSlug(genre.name)
    merged.set(slug, { slug, name: genre.name, movieId: genre.id })
  })
  tvGenres.forEach((genre) => {
    const slug = genreSlug(genre.name)
    const existing = merged.get(slug)
    merged.set(slug, existing ? { ...existing, tvId: genre.id } : { slug, name: genre.name, tvId: genre.id })
  })
  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name))
}

async function loadGenreItems(genre: { movieId?: number; tvId?: number }) {
  const [movieResponse, tvResponse] = await Promise.all([
    genre.movieId ? fetchGenre("movie", genre.movieId, 1) : Promise.resolve({ results: [], page: 1 }),
    genre.tvId ? fetchGenre("tv", genre.tvId, 1) : Promise.resolve({ results: [], page: 1 }),
  ])
  return mergeGenreResults(movieResponse, tvResponse)
}

export async function loadDiscoverPayload(): Promise<DiscoverPayload> {
  const year = currentYear()
  const recent = recentWindow()
  const voteFloor = await resolveTop250VoteFloor(year)
  const [trendingMovies, trendingTv, recentMovies, recentTv, top250, popularMovies, popularTv, topRatedMovies, topRatedTv] = await Promise.all([
    fetchTrending("movie"),
    fetchTrending("tv"),
    fetchRecent("movie", recent.from, recent.to),
    fetchRecent("tv", recent.from, recent.to),
    fetchTop250Movies(year, voteFloor, 1),
    fetchPopular("movie"),
    fetchPopular("tv"),
    fetchTopRated("movie"),
    fetchTopRated("tv"),
  ])
  return {
    rails: [
      rail("trending-movies", "Trending Movies", normalizePage(trendingMovies, "movie")),
      rail("trending-series", "Trending Series", normalizePage(trendingTv, "tv")),
      rail("recent-movies", "Recent Movies", normalizePage(recentMovies, "movie")),
      rail("recent-series", "Recent Series", normalizePage(recentTv, "tv")),
      rail("top-250-movies", `Top 250 Movies · ${year}`, normalizePage(top250, "movie"), `/browse/top-250-movies?year=${year}`),
      rail("popular-movies", "Popular Movies", normalizePage(popularMovies, "movie")),
      rail("popular-series", "Popular Series", normalizePage(popularTv, "tv")),
      rail("top-rated-movies", "Top Rated Movies", normalizePage(topRatedMovies, "movie")),
      rail("top-rated-series", "Top Rated Series", normalizePage(topRatedTv, "tv")),
    ],
    page: 1,
    source: "tmdb",
    year,
  }
}

export async function loadGenreRailsPayload(): Promise<GenreRailsPayload> {
  const [movieResponse, tvResponse] = await Promise.all([fetchGenres("movie"), fetchGenres("tv")])
  const genres = mergeGenres(movieResponse.genres, tvResponse.genres)
  const rails = await Promise.all(genres.map(async (genre) => ({
    key: `genre-${genre.slug}`,
    slug: genre.slug,
    label: genre.name,
    items: await loadGenreItems(genre),
    href: `/browse/genre/${genre.slug}?name=${encodeURIComponent(genre.name)}`,
  })))
  return { rails: rails.filter((item) => item.items.length > 0), source: "tmdb" }
}

async function loadGenreBrowsePayload(slug: string, page: number) {
  const [movieResponse, tvResponse] = await Promise.all([fetchGenres("movie"), fetchGenres("tv")])
  const genre = mergeGenres(movieResponse.genres, tvResponse.genres).find((item) => item.slug === slug)
  if (!genre) throw new Error("That genre is not available")
  const [moviePage, tvPage] = await Promise.all([
    genre.movieId ? fetchGenre("movie", genre.movieId, page) : Promise.resolve({ results: [], page: 1, total_results: 0, total_pages: 0 }),
    genre.tvId ? fetchGenre("tv", genre.tvId, page) : Promise.resolve({ results: [], page: 1, total_results: 0, total_pages: 0 }),
  ])
  const items = mergeGenreResults(moviePage, tvPage)
  const total = Math.min((moviePage.total_results ?? 0) + (tvPage.total_results ?? 0), 500)
  return {
    key: `genre-${slug}`,
    genreSlug: slug,
    label: genre.name,
    items,
    page,
    totalResults: total,
    totalPages: Math.max(moviePage.total_pages ?? 1, tvPage.total_pages ?? 1),
    source: "tmdb" as const,
  }
}

export async function loadBrowsePayload(category: string, options: BrowseOptions = {}): Promise<BrowsePayload> {
  const page = Math.max(1, options.page ?? 1)
  if (category.startsWith("genre-")) return loadGenreBrowsePayload(options.genreSlug ?? category.slice("genre-".length), page)

  if (category === "top-250-movies") {
    const year = options.year ?? currentYear()
    const top250 = await loadTop250Page(year, page)
    return {
      key: category,
      label: `Top 250 Movies · ${year}`,
      items: top250.items,
      page,
      totalResults: top250.totalResults,
      totalPages: top250.totalPages,
      year,
      source: "tmdb",
    }
  }

  const recent = recentWindow()
  const configs: Record<string, { label: string; mediaType: "movie" | "tv"; load: () => Promise<TmdbPagedListResponse> }> = {
    "trending-movies": { label: "Trending Movies", mediaType: "movie", load: () => fetchTrending("movie") },
    "trending-series": { label: "Trending Series", mediaType: "tv", load: () => fetchTrending("tv") },
    "recent-movies": { label: "Recent Movies", mediaType: "movie", load: () => fetchRecent("movie", recent.from, recent.to, page) },
    "recent-series": { label: "Recent Series", mediaType: "tv", load: () => fetchRecent("tv", recent.from, recent.to, page) },
    "popular-movies": { label: "Popular Movies", mediaType: "movie", load: () => fetchPopular("movie", page) },
    "popular-series": { label: "Popular Series", mediaType: "tv", load: () => fetchPopular("tv", page) },
    "top-rated-movies": { label: "Top Rated Movies", mediaType: "movie", load: () => fetchTopRated("movie", page) },
    "top-rated-series": { label: "Top Rated Series", mediaType: "tv", load: () => fetchTopRated("tv", page) },
    "now-playing-movies": { label: "Now Playing", mediaType: "movie", load: () => fetchNowPlayingMovies(page) },
    "on-the-air-series": { label: "On The Air", mediaType: "tv", load: () => fetchOnTheAirSeries(page) },
  }
  const config = configs[category]
  if (!config) throw new Error("That catalog section is not available")
  const response = await config.load()
  return {
    key: category,
    label: config.label,
    items: normalizePage(response, config.mediaType),
    page,
    totalResults: totalResults(response, response.results.length),
    totalPages: totalPages(response, 1),
    source: "tmdb",
  }
}

export async function loadSearchPayload(query: string, page = 1): Promise<SearchPayload> {
  const response = await fetchSearch(query, page)
  return {
    items: response.results.map(normalizeListItem).filter(isNormalizedTitle),
    page: response.page,
    source: "tmdb",
  }
}

export async function loadTitlePayload(mediaType: "movie" | "tv", tmdbId: number) {
  return normalizeTitle(await fetchTitle(mediaType, tmdbId), mediaType)
}

export async function loadSeasonPayload(tmdbId: number, seasonNumber: number): Promise<SeasonPayload> {
  const result = await fetchSeason(tmdbId, seasonNumber)
  return {
    tmdbId,
    seasonNumber,
    name: result.name ?? `Season ${seasonNumber}`,
    overview: result.overview ?? "",
    episodeCount: result.episodes?.length ?? 0,
    episodes: result.episodes?.map(normalizeEpisode) ?? [],
  }
}

export async function loadExternalIds(mediaType: "movie" | "tv", tmdbId: number) {
  return fetchExternalIds(mediaType, tmdbId)
}
