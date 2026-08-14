import { v } from "convex/values"
import { action, internalMutation, internalQuery, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { cacheKey, CACHE_TTL_MS, currentYear, loadBrowsePayload, loadDiscoverPayload, loadGenreRailsPayload, loadSearchPayload, loadSeasonPayload, loadTitlePayload, recentWindow, type BrowsePayload, type DiscoverPayload, type GenreRailsPayload, type SearchPayload, type StoredSeasonPayload } from "./catalogActions"
import type { NormalizedTitle } from "./lib/normalize"

const mediaType = v.union(v.literal("movie"), v.literal("tv"))
const credit = v.object({
  id: v.number(),
  name: v.string(),
  character: v.optional(v.string()),
  profilePath: v.optional(v.string()),
})
const normalizedTitle = v.object({
  tmdbId: v.number(),
  imdbId: v.optional(v.string()),
  mediaType,
  title: v.string(),
  originalTitle: v.optional(v.string()),
  overview: v.string(),
  releaseDate: v.optional(v.string()),
  genres: v.array(v.string()),
  runtime: v.optional(v.number()),
  rating: v.optional(v.number()),
  posterPath: v.optional(v.string()),
  backdropPath: v.optional(v.string()),
  credits: v.optional(v.array(credit)),
  seasons: v.optional(v.array(v.object({
    seasonNumber: v.number(),
    name: v.string(),
    episodeCount: v.number(),
  }))),
  trailers: v.optional(v.array(v.object({
    key: v.string(),
    name: v.string(),
    site: v.string(),
    type: v.string(),
    official: v.optional(v.boolean()),
  }))),
  images: v.optional(v.array(v.object({
    filePath: v.string(),
    width: v.number(),
    height: v.number(),
  }))),
  recommendations: v.optional(v.array(v.object({
    tmdbId: v.number(),
    mediaType,
    title: v.string(),
    releaseDate: v.optional(v.string()),
    rating: v.optional(v.number()),
    posterPath: v.optional(v.string()),
    backdropPath: v.optional(v.string()),
  }))),
})
const discoverRail = v.object({
  key: v.string(),
  label: v.string(),
  items: v.array(normalizedTitle),
  href: v.string(),
})
const genreRail = v.object({
  key: v.string(),
  slug: v.string(),
  label: v.string(),
  items: v.array(normalizedTitle),
  href: v.string(),
})
const episode = v.object({
  id: v.number(),
  episodeNumber: v.number(),
  name: v.string(),
  overview: v.string(),
  airDate: v.optional(v.string()),
  runtime: v.optional(v.number()),
  stillPath: v.optional(v.string()),
  voteAverage: v.optional(v.number()),
})
const season = v.object({
  tmdbId: v.number(),
  seasonNumber: v.number(),
  name: v.string(),
  overview: v.string(),
  episodeCount: v.number(),
  episodes: v.array(episode),
  updatedAt: v.number(),
})
const cacheEntry = v.object({
  _id: v.id("discoveryCache"),
  _creationTime: v.number(),
  key: v.string(),
  mediaType: v.optional(mediaType),
  payload: v.any(),
  expiresAt: v.number(),
})
const discoverPayload = v.object({
  rails: v.array(discoverRail),
  page: v.number(),
  year: v.number(),
  source: v.literal("tmdb"),
})
const genreRailsPayload = v.object({
  rails: v.array(genreRail),
  source: v.literal("tmdb"),
})
const searchPayload = v.object({
  items: v.array(normalizedTitle),
  page: v.number(),
  source: v.literal("tmdb"),
})
const browsePayload = v.object({
  key: v.string(),
  label: v.string(),
  items: v.array(normalizedTitle),
  page: v.number(),
  totalResults: v.number(),
  totalPages: v.number(),
  year: v.optional(v.number()),
  genreSlug: v.optional(v.string()),
  source: v.literal("tmdb"),
})

export const getCachedTitle = query({
  args: { tmdbId: v.number(), mediaType },
  returns: v.union(normalizedTitle.extend({ updatedAt: v.number() }), v.null()),
  handler: async (ctx, args): Promise<(NormalizedTitle & { updatedAt: number }) | null> => {
    const stored = await ctx.db.query("titles").withIndex("by_tmdb_media", (q) => q.eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType)).unique()
    if (!stored) return null
    const { _id, _creationTime, ...title } = stored
    void _id
    void _creationTime
    return title
  },
})

export const getCachedDiscover = query({
  args: {},
  returns: v.union(cacheEntry, v.null()),
  handler: async (ctx) => ctx.db.query("discoveryCache").withIndex("by_key", (q) => q.eq("key", "discover:home")).unique(),
})

export const getCachedSearch = query({
  args: { query: v.string(), page: v.optional(v.number()) },
  returns: v.union(cacheEntry, v.null()),
  handler: async (ctx, args) => ctx.db.query("discoveryCache").withIndex("by_key", (q) => q.eq("key", cacheKey("search", `${args.query}:${args.page ?? 1}`))).unique(),
})

export const getCachedSeason = query({
  args: { tmdbId: v.number(), seasonNumber: v.number() },
  returns: v.union(season, v.null()),
  handler: async (ctx, args): Promise<StoredSeasonPayload | null> => {
    const stored = await ctx.db.query("seasons").withIndex("by_tmdb_season", (q) => q.eq("tmdbId", args.tmdbId).eq("seasonNumber", args.seasonNumber)).unique()
    if (!stored) return null
    const { _id, _creationTime, ...payload } = stored
    void _id
    void _creationTime
    return payload
  },
})

export const getCachedTitleInternal = internalQuery({
  args: { tmdbId: v.number(), mediaType },
  returns: v.union(normalizedTitle.extend({ updatedAt: v.number() }), v.null()),
  handler: async (ctx, args): Promise<(NormalizedTitle & { updatedAt: number }) | null> => {
    const stored = await ctx.db.query("titles").withIndex("by_tmdb_media", (q) => q.eq("tmdbId", args.tmdbId).eq("mediaType", args.mediaType)).unique()
    if (!stored) return null
    const { _id, _creationTime, ...title } = stored
    void _id
    void _creationTime
    return title
  },
})

export const getCachedDiscoveryInternal = internalQuery({
  args: { key: v.string() },
  returns: v.union(cacheEntry, v.null()),
  handler: async (ctx, args) => ctx.db.query("discoveryCache").withIndex("by_key", (q) => q.eq("key", args.key)).unique(),
})

export const getCachedSeasonInternal = internalQuery({
  args: { tmdbId: v.number(), seasonNumber: v.number() },
  returns: v.union(season, v.null()),
  handler: async (ctx, args): Promise<StoredSeasonPayload | null> => {
    const stored = await ctx.db.query("seasons").withIndex("by_tmdb_season", (q) => q.eq("tmdbId", args.tmdbId).eq("seasonNumber", args.seasonNumber)).unique()
    if (!stored) return null
    const { _id, _creationTime, ...payload } = stored
    void _id
    void _creationTime
    return payload
  },
})

export const storeTitle = internalMutation({
  args: { title: normalizedTitle.extend({ updatedAt: v.number() }) },
  returns: normalizedTitle.extend({ updatedAt: v.number() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("titles").withIndex("by_tmdb_media", (q) => q.eq("tmdbId", args.title.tmdbId).eq("mediaType", args.title.mediaType)).unique()
    if (existing) await ctx.db.patch(existing._id, args.title)
    else await ctx.db.insert("titles", args.title)
    return args.title
  },
})

export const storeCache = internalMutation({
  args: { key: v.string(), payload: v.any(), expiresAt: v.number(), mediaType: v.optional(mediaType) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("discoveryCache").withIndex("by_key", (q) => q.eq("key", args.key)).unique()
    if (existing) await ctx.db.patch(existing._id, args)
    else await ctx.db.insert("discoveryCache", args)
    return null
  },
})

export const storeSeason = internalMutation({
  args: { season },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("seasons").withIndex("by_tmdb_season", (q) => q.eq("tmdbId", args.season.tmdbId).eq("seasonNumber", args.season.seasonNumber)).unique()
    if (existing) await ctx.db.patch(existing._id, args.season)
    else await ctx.db.insert("seasons", args.season)
    return null
  },
})

export const discover = action({
  args: {},
  returns: discoverPayload,
  handler: async (ctx): Promise<DiscoverPayload> => {
    const recent = recentWindow()
    const key = cacheKey("discover", `${currentYear()}:${recent.key}`)
    const cached: { payload: DiscoverPayload; expiresAt: number } | null = await ctx.runQuery(internal.catalog.getCachedDiscoveryInternal, { key })
    if (cached && cached.expiresAt > Date.now()) return cached.payload
    const payload = await loadDiscoverPayload()
    await ctx.runMutation(internal.catalog.storeCache, { key, payload, expiresAt: Date.now() + CACHE_TTL_MS })
    return payload
  },
})

export const genreRails = action({
  args: {},
  returns: genreRailsPayload,
  handler: async (ctx): Promise<GenreRailsPayload> => {
    const key = "genres:home"
    const cached: { payload: GenreRailsPayload; expiresAt: number } | null = await ctx.runQuery(internal.catalog.getCachedDiscoveryInternal, { key })
    if (cached && cached.expiresAt > Date.now()) return cached.payload
    const payload = await loadGenreRailsPayload()
    await ctx.runMutation(internal.catalog.storeCache, { key, payload, expiresAt: Date.now() + CACHE_TTL_MS })
    return payload
  },
})

export const search = action({
  args: { query: v.string(), page: v.optional(v.number()) },
  returns: searchPayload,
  handler: async (ctx, args): Promise<SearchPayload> => {
    const page = args.page ?? 1
    const key = cacheKey("search", `${args.query}:${page}`)
    const cached: { payload: SearchPayload; expiresAt: number } | null = await ctx.runQuery(internal.catalog.getCachedDiscoveryInternal, { key })
    if (cached && cached.expiresAt > Date.now()) return cached.payload
    const payload = await loadSearchPayload(args.query, page)
    await ctx.runMutation(internal.catalog.storeCache, { key, payload, expiresAt: Date.now() + CACHE_TTL_MS })
    return payload
  },
})

export const browse = action({
  args: { category: v.string(), page: v.optional(v.number()), year: v.optional(v.number()), genreSlug: v.optional(v.string()) },
  returns: browsePayload,
  handler: async (ctx, args): Promise<BrowsePayload> => {
    const recent = args.category.startsWith("recent-") ? recentWindow().key : ""
    const key = cacheKey("browse", `${args.category}:${args.page ?? 1}:${args.year ?? ""}:${args.genreSlug ?? ""}:${recent}`)
    const cached: { payload: BrowsePayload; expiresAt: number } | null = await ctx.runQuery(internal.catalog.getCachedDiscoveryInternal, { key })
    if (cached && cached.expiresAt > Date.now()) return cached.payload
    const payload = await loadBrowsePayload(args.category, args)
    await ctx.runMutation(internal.catalog.storeCache, { key, payload, expiresAt: Date.now() + CACHE_TTL_MS })
    return payload
  },
})

export const getTitle = action({
  args: { tmdbId: v.number(), mediaType },
  returns: normalizedTitle.extend({ updatedAt: v.number() }),
  handler: async (ctx, args): Promise<NormalizedTitle & { updatedAt: number }> => {
    const cached: (NormalizedTitle & { updatedAt: number }) | null = await ctx.runQuery(internal.catalog.getCachedTitleInternal, args)
    const enriched = cached?.trailers !== undefined && cached.images !== undefined && cached.recommendations !== undefined
    if (cached && enriched && cached.updatedAt + CACHE_TTL_MS > Date.now()) return cached
    const title = { ...(await loadTitlePayload(args.mediaType, args.tmdbId)), updatedAt: Date.now() }
    await ctx.runMutation(internal.catalog.storeTitle, { title })
    return title
  },
})

export const getSeason = action({
  args: { tmdbId: v.number(), seasonNumber: v.number() },
  returns: season,
  handler: async (ctx, args): Promise<StoredSeasonPayload> => {
    const cached: StoredSeasonPayload | null = await ctx.runQuery(internal.catalog.getCachedSeasonInternal, args)
    if (cached && cached.updatedAt + CACHE_TTL_MS > Date.now()) return cached
    const season = { ...(await loadSeasonPayload(args.tmdbId, args.seasonNumber)), updatedAt: Date.now() }
    await ctx.runMutation(internal.catalog.storeSeason, { season })
    return season
  },
})
