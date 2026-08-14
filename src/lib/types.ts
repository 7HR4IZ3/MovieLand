export type MediaType = "movie" | "tv"

export type Credit = {
  id: number
  name: string
  character?: string
  profilePath?: string
}

export type TrailerVideo = {
  key: string
  name: string
  site: string
  type: string
  official?: boolean
}

export type MediaImage = {
  filePath: string
  width: number
  height: number
}

export type MediaRecommendation = {
  tmdbId: number
  mediaType: MediaType
  title: string
  releaseDate?: string
  rating?: number
  posterPath?: string
  backdropPath?: string
}

export type Episode = {
  id: number
  episodeNumber: number
  name: string
  overview: string
  airDate?: string
  runtime?: number
  stillPath?: string
  voteAverage?: number
}

export type Season = {
  tmdbId: number
  seasonNumber: number
  name: string
  overview: string
  episodeCount: number
  episodes: Episode[]
}

export type MediaTitle = {
  tmdbId: number
  imdbId?: string
  mediaType: MediaType
  title: string
  originalTitle?: string
  overview: string
  releaseDate?: string
  genres: string[]
  runtime?: number
  rating?: number
  posterPath?: string
  backdropPath?: string
  credits?: Credit[]
  seasons?: Array<Pick<Season, "seasonNumber" | "name" | "episodeCount">>
  trailers?: TrailerVideo[]
  images?: MediaImage[]
  recommendations?: MediaRecommendation[]
}

export type CatalogRail = {
  key: string
  label: string
  items: MediaTitle[]
  href?: string
}

export type CatalogResponse = {
  rails: CatalogRail[]
  page: number
  year?: number
  source: "tmdb" | "fixture"
}

export type GenreRail = {
  key: string
  slug: string
  label: string
  items: MediaTitle[]
  href: string
}

export type GenreRailsResponse = {
  rails: GenreRail[]
  source: "tmdb" | "fixture"
}

export type BrowseOptions = {
  page?: number
  year?: number
  genreSlug?: string
}

export type BrowseResponse = {
  key: string
  label: string
  items: MediaTitle[]
  page: number
  totalResults: number
  totalPages: number
  year?: number
  genreSlug?: string
  source: "tmdb" | "fixture"
}
