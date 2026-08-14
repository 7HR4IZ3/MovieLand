const TMDB_BASE_URL = "https://api.themoviedb.org/3"

declare const process: {
  env: {
    TMDB_READ_ACCESS_TOKEN?: string
    TMDB_API_KEY?: string
  }
}

type TmdbFetchOptions = {
  path: string
  params?: Record<string, string | number | undefined>
}

export async function tmdbFetch<T>({ path, params = {} }: TmdbFetchOptions): Promise<T> {
  const token = process.env.TMDB_READ_ACCESS_TOKEN
  const apiKey = process.env.TMDB_API_KEY
  if (!token && !apiKey) {
    throw new Error("TMDB credentials are not configured in Convex")
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`)
  Object.entries({ language: "en-US", ...params }).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value))
  })
  if (!token && apiKey) url.searchParams.set("api_key", apiKey)

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`TMDB request failed (${response.status}): ${body.slice(0, 180)}`)
  }
  return response.json() as Promise<T>
}

export type TmdbListResponse = { results: Array<Record<string, unknown>>; page: number }

export type TmdbPagedListResponse = TmdbListResponse & {
  total_pages?: number
  total_results?: number
}

export type TmdbGenre = { id: number; name: string }

export type TmdbGenreListResponse = { genres: TmdbGenre[] }

export type DiscoverParams = {
  page?: number
  sort_by?: string
  vote_count_gte?: number
  primary_release_date_gte?: string
  primary_release_date_lte?: string
  first_air_date_gte?: string
  first_air_date_lte?: string
  with_genres?: number
}

export async function fetchDiscover(mediaType: "movie" | "tv", params: DiscoverParams = {}) {
  return tmdbFetch<TmdbPagedListResponse>({
    path: `/discover/${mediaType}`,
    params: {
      page: params.page ?? 1,
      sort_by: params.sort_by ?? "popularity.desc",
      include_adult: "false",
      include_video: "false",
      ...(params.vote_count_gte === undefined ? {} : { "vote_count.gte": params.vote_count_gte }),
      ...(params.primary_release_date_gte === undefined ? {} : { "primary_release_date.gte": params.primary_release_date_gte }),
      ...(params.primary_release_date_lte === undefined ? {} : { "primary_release_date.lte": params.primary_release_date_lte }),
      ...(params.first_air_date_gte === undefined ? {} : { "first_air_date.gte": params.first_air_date_gte }),
      ...(params.first_air_date_lte === undefined ? {} : { "first_air_date.lte": params.first_air_date_lte }),
      ...(params.with_genres === undefined ? {} : { with_genres: params.with_genres }),
    },
  })
}

export async function fetchTrending(mediaType: "movie" | "tv") {
  return tmdbFetch<TmdbListResponse>({ path: `/trending/${mediaType}/week` })
}

export async function fetchPopular(mediaType: "movie" | "tv", page = 1) {
  return fetchDiscover(mediaType, { page })
}

export async function fetchTopRated(mediaType: "movie" | "tv", page = 1) {
  return tmdbFetch<TmdbPagedListResponse>({ path: `/${mediaType}/top_rated`, params: { page } })
}

export async function fetchNowPlayingMovies(page = 1) {
  return tmdbFetch<TmdbListResponse>({ path: "/movie/now_playing", params: { page } })
}

export async function fetchOnTheAirSeries(page = 1) {
  return tmdbFetch<TmdbPagedListResponse>({ path: "/tv/on_the_air", params: { page } })
}

export async function fetchRecent(mediaType: "movie" | "tv", from: string, to: string, page = 1) {
  return fetchDiscover(mediaType, mediaType === "movie"
    ? { page, sort_by: "primary_release_date.desc", primary_release_date_gte: from, primary_release_date_lte: to }
    : { page, sort_by: "first_air_date.desc", first_air_date_gte: from, first_air_date_lte: to })
}

export async function fetchTop250Movies(year: number, voteFloor: number, page = 1) {
  return fetchDiscover("movie", {
    page,
    sort_by: "vote_average.desc",
    vote_count_gte: voteFloor,
    primary_release_date_gte: `${year}-01-01`,
    primary_release_date_lte: `${year}-12-31`,
  })
}

export async function fetchGenres(mediaType: "movie" | "tv") {
  return tmdbFetch<TmdbGenreListResponse>({ path: `/genre/${mediaType}/list` })
}

export async function fetchGenre(mediaType: "movie" | "tv", genreId: number, page = 1) {
  return fetchDiscover(mediaType, { page, with_genres: genreId, sort_by: "popularity.desc" })
}

export async function fetchSearch(query: string, page = 1) {
  return tmdbFetch<TmdbListResponse>({ path: "/search/multi", params: { query, page, include_adult: "false" } })
}

export async function fetchExternalIds(mediaType: "movie" | "tv", tmdbId: number) {
  return tmdbFetch<{ imdb_id?: string }>({ path: `/${mediaType}/${tmdbId}/external_ids` })
}

export async function fetchTitle(mediaType: "movie" | "tv", tmdbId: number) {
  const [details, externalIds] = await Promise.all([
    tmdbFetch<Record<string, unknown>>({ path: `/${mediaType}/${tmdbId}`, params: { append_to_response: "credits,videos,images,recommendations" } }),
    fetchExternalIds(mediaType, tmdbId),
  ])
  return { ...details, externalIds }
}

export async function fetchSeason(tmdbId: number, seasonNumber: number) {
  return tmdbFetch<{
    name?: string
    overview?: string
    episodes?: Array<Record<string, unknown>>
  }>({ path: `/tv/${tmdbId}/season/${seasonNumber}` })
}
