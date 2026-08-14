type AnyRecord = Record<string, any>

export type NormalizedTitle = {
  tmdbId: number
  imdbId?: string
  mediaType: "movie" | "tv"
  title: string
  originalTitle?: string
  overview: string
  releaseDate?: string
  genres: string[]
  runtime?: number
  rating?: number
  posterPath?: string
  backdropPath?: string
  credits?: Array<{ id: number; name: string; character?: string; profilePath?: string }>
  seasons?: Array<{ seasonNumber: number; name: string; episodeCount: number }>
  trailers?: Array<{ key: string; name: string; site: string; type: string; official?: boolean }>
  images?: Array<{ filePath: string; width: number; height: number }>
  recommendations?: Array<{
    tmdbId: number
    mediaType: "movie" | "tv"
    title: string
    releaseDate?: string
    rating?: number
    posterPath?: string
    backdropPath?: string
  }>
}

export type NormalizedEpisode = {
  id: number
  episodeNumber: number
  name: string
  overview: string
  airDate?: string
  runtime?: number
  stillPath?: string
  voteAverage?: number
}

function isNormalizedTitle(input: NormalizedTitle | null): input is NormalizedTitle {
  return input !== null
}

export function normalizeTitle(input: AnyRecord, mediaType: "movie" | "tv"): NormalizedTitle {
  const credits = input.credits?.cast?.slice(0, 12)?.map((person: AnyRecord) => ({
    id: person.id,
    name: person.name,
    character: person.character,
    profilePath: person.profile_path,
  }))
  const trailers = input.videos?.results
    ?.filter((video: AnyRecord) => video.site === "YouTube" && video.key && ["Trailer", "Teaser", "Clip"].includes(video.type))
    ?.slice(0, 6)
    ?.map((video: AnyRecord) => ({
      key: video.key,
      name: video.name ?? "Trailer",
      site: video.site,
      type: video.type ?? "Trailer",
      official: video.official === true ? true : undefined,
    }))
  const images = input.images?.backdrops
    ?.filter((image: AnyRecord) => image.file_path)
    ?.slice(0, 12)
    ?.map((image: AnyRecord) => ({
      filePath: image.file_path,
      width: Number(image.width ?? 0),
      height: Number(image.height ?? 0),
    }))
  const recommendations = input.recommendations?.results
    ?.map((item: AnyRecord) => normalizeListItem({ ...item, media_type: mediaType }))
    ?.filter(isNormalizedTitle)
    ?.filter((item: NormalizedTitle) => item.tmdbId !== Number(input.id))
    ?.slice(0, 12)
    ?.map((item: NormalizedTitle) => ({
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      releaseDate: item.releaseDate,
      rating: item.rating,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
    }))
  return {
    tmdbId: Number(input.id),
    imdbId: input.externalIds?.imdb_id ?? input.imdb_id ?? undefined,
    mediaType,
    title: input.title ?? input.name ?? "Untitled",
    originalTitle: input.original_title ?? input.original_name ?? undefined,
    overview: input.overview ?? "No synopsis is available yet.",
    releaseDate: input.release_date ?? input.first_air_date ?? undefined,
    genres: input.genres?.map((genre: AnyRecord) => genre.name) ?? [],
    runtime: input.runtime ?? input.episode_run_time?.[0] ?? undefined,
    rating: typeof input.vote_average === "number" ? input.vote_average : undefined,
    posterPath: input.poster_path ?? undefined,
    backdropPath: input.backdrop_path ?? undefined,
    credits,
    seasons: mediaType === "tv" ? input.seasons?.filter((season: AnyRecord) => season.season_number > 0).map((season: AnyRecord) => ({
      seasonNumber: season.season_number,
      name: season.name,
      episodeCount: season.episode_count,
    })) : undefined,
    trailers,
    images,
    recommendations,
  }
}

export function normalizeListItem(input: AnyRecord): NormalizedTitle | null {
  const mediaType = input.media_type === "tv" || input.first_air_date !== undefined ? "tv" : input.media_type === "movie" || input.release_date !== undefined ? "movie" : null
  return mediaType ? normalizeTitle(input, mediaType) : null
}

export function normalizeEpisode(input: AnyRecord): NormalizedEpisode {
  return {
    id: Number(input.id),
    episodeNumber: Number(input.episode_number),
    name: input.name ?? "Untitled episode",
    overview: input.overview ?? "No synopsis is available yet.",
    airDate: input.air_date ?? undefined,
    runtime: input.runtime ?? undefined,
    stillPath: input.still_path ?? undefined,
    voteAverage: typeof input.vote_average === "number" ? input.vote_average : undefined,
  }
}
