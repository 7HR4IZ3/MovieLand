import type { CatalogResponse, Episode, MediaTitle, Season } from "./types"

const titles: MediaTitle[] = [
  {
    tmdbId: 27205,
    imdbId: "tt1375666",
    mediaType: "movie",
    title: "Inception",
    originalTitle: "Inception",
    overview: "A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a CEO.",
    releaseDate: "2010-07-15",
    genres: ["Action", "Science Fiction", "Adventure"],
    runtime: 148,
    rating: 8.4,
    posterPath: "/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    backdropPath: "/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
    credits: [{ id: 6193, name: "Leonardo DiCaprio", character: "Cobb" }, { id: 2524, name: "Joseph Gordon-Levitt", character: "Arthur" }, { id: 3896, name: "Tom Hardy", character: "Eames" }],
  },
  {
    tmdbId: 438631,
    imdbId: "tt1160419",
    mediaType: "movie",
    title: "Dune: Part One",
    overview: "Paul Atreides arrives on Arrakis with his noble family as they become embroiled in a war for the planet's most valuable resource.",
    releaseDate: "2021-09-09",
    genres: ["Science Fiction", "Adventure"],
    runtime: 155,
    rating: 8.0,
    posterPath: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    backdropPath: "/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg",
    credits: [{ id: 1190668, name: "Timothée Chalamet", character: "Paul Atreides" }, { id: 505710, name: "Rebecca Ferguson", character: "Lady Jessica" }],
  },
  {
    tmdbId: 414906,
    imdbId: "tt1877830",
    mediaType: "movie",
    title: "The Batman",
    overview: "Batman ventures into Gotham City's underworld when a sadistic killer leaves behind a trail of cryptic clues.",
    releaseDate: "2022-03-01",
    genres: ["Crime", "Mystery", "Thriller"],
    runtime: 176,
    rating: 7.7,
    posterPath: "/74xTEgt7R36Fpooo50r9T25onhq.jpg",
    backdropPath: "/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg",
    credits: [{ id: 11288, name: "Robert Pattinson", character: "Bruce Wayne" }, { id: 115440, name: "Zoë Kravitz", character: "Selina Kyle" }],
  },
  {
    tmdbId: 329865,
    imdbId: "tt2543164",
    mediaType: "movie",
    title: "Arrival",
    overview: "A linguist works with the military to communicate with alien lifeforms after mysterious spacecraft appear around the world.",
    releaseDate: "2016-11-10",
    genres: ["Drama", "Science Fiction", "Mystery"],
    runtime: 116,
    rating: 7.6,
    posterPath: "/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg",
    backdropPath: "/sZ1KJSbS2a3g9PqfU7W8h4f0k8a.jpg",
    credits: [{ id: 140523, name: "Amy Adams", character: "Louise Banks" }, { id: 9042, name: "Jeremy Renner", character: "Ian Donnelly" }],
  },
  {
    tmdbId: 693134,
    mediaType: "movie",
    title: "Dune: Part Two",
    overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
    releaseDate: "2024-02-27",
    genres: ["Science Fiction", "Adventure"],
    runtime: 167,
    rating: 8.2,
    posterPath: "/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    backdropPath: "/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg",
  },
  {
    tmdbId: 94605,
    imdbId: "tt0475784",
    mediaType: "tv",
    title: "Westworld",
    overview: "A dark odyssey about the dawn of artificial consciousness and the future of sin.",
    releaseDate: "2016-10-02",
    genres: ["Science Fiction", "Western", "Drama"],
    rating: 8.1,
    posterPath: "/8MfgyFHf7XEboZJPZXCIDqqiz6e.jpg",
    backdropPath: "/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
    credits: [{ id: 51797, name: "Evan Rachel Wood", character: "Dolores Abernathy" }, { id: 17182, name: "Jeffrey Wright", character: "Bernard Lowe" }],
    seasons: [{ seasonNumber: 1, name: "Season 1", episodeCount: 10 }, { seasonNumber: 2, name: "Season 2", episodeCount: 10 }],
  },
  {
    tmdbId: 1399,
    imdbId: "tt0944947",
    mediaType: "tv",
    title: "Game of Thrones",
    overview: "Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns after being dormant for millennia.",
    releaseDate: "2011-04-17",
    genres: ["Drama", "Fantasy", "Adventure"],
    rating: 8.4,
    posterPath: "/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg",
    backdropPath: "/2OMB0ynKlyIenMJWI2Dy9IWT4c.jpg",
    credits: [{ id: 239019, name: "Emilia Clarke", character: "Daenerys Targaryen" }, { id: 58372, name: "Kit Harington", character: "Jon Snow" }],
    seasons: [{ seasonNumber: 1, name: "Season 1", episodeCount: 10 }, { seasonNumber: 2, name: "Season 2", episodeCount: 10 }],
  },
  {
    tmdbId: 94997,
    mediaType: "tv",
    title: "House of the Dragon",
    overview: "The Targaryen dynasty is at the height of its power, with more than 15 dragons under their control.",
    releaseDate: "2022-08-21",
    genres: ["Drama", "Fantasy", "Action"],
    rating: 8.4,
    posterPath: "/z2yahl2uefxDCl0nogcRBstwZQ.jpg",
    backdropPath: "/etj8E2o0Bud0HkONVQPjyCkIvp.jpg",
    credits: [{ id: 224513, name: "Emma D'Arcy", character: "Rhaenyra Targaryen" }, { id: 1510408, name: "Matt Smith", character: "Daemon Targaryen" }],
    seasons: [{ seasonNumber: 1, name: "Season 1", episodeCount: 10 }, { seasonNumber: 2, name: "Season 2", episodeCount: 8 }],
  },
]

const episodes: Episode[] = Array.from({ length: 10 }, (_, index) => ({
  id: 1000 + index,
  episodeNumber: index + 1,
  name: ["The Beginning", "A New World", "The Crossing", "The Witness", "The Door", "The Adversary", "Trompe L'Oeil", "Trace Decay", "The Well-Tempered Clavier", "The Bicameral Mind"][index],
  overview: "The story moves deeper into the world behind the story, revealing new motives and uneasy alliances.",
  airDate: `2016-10-${String(2 + index).padStart(2, "0")}`,
  runtime: 59,
  stillPath: "/9xxgqQ6M8Y2j5aZ7b8r9c0d1e2f.jpg",
  voteAverage: 8.1,
}))

export const fixtureSeasons: Record<number, Season> = {
  94605: { tmdbId: 94605, seasonNumber: 1, name: "Season 1", overview: "The park's hosts begin to question the limits of their world.", episodeCount: episodes.length, episodes },
  1399: { tmdbId: 1399, seasonNumber: 1, name: "Season 1", overview: "The great houses gather as winter approaches.", episodeCount: episodes.length, episodes },
  94997: { tmdbId: 94997, seasonNumber: 1, name: "Season 1", overview: "The Targaryen succession begins to fracture.", episodeCount: episodes.length, episodes },
}

export const fixtureCatalog: CatalogResponse = {
  source: "fixture",
  page: 1,
  rails: [
    { key: "continue", label: "Continue Watching", items: [titles[0], titles[5], titles[6]] },
    { key: "trending", label: "Trending This Week", items: [titles[1], titles[2], titles[7], titles[4]] },
    { key: "movies", label: "Movies For The Evening", items: [titles[0], titles[3], titles[4], titles[2]] },
    { key: "series", label: "Series Worth Starting", items: [titles[6], titles[7], titles[5]] },
  ],
}

export function getFixtureTitle(mediaType: "movie" | "tv", tmdbId: number) {
  return titles.find((title) => title.mediaType === mediaType && title.tmdbId === tmdbId)
}

export function searchFixtures(query: string) {
  const normalized = query.toLowerCase().trim()
  return titles.filter((title) => `${title.title} ${title.genres.join(" ")}`.toLowerCase().includes(normalized))
}
