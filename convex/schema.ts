import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

const credit = v.object({
  id: v.number(),
  name: v.string(),
  character: v.optional(v.string()),
  profilePath: v.optional(v.string()),
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

const trailer = v.object({
  key: v.string(),
  name: v.string(),
  site: v.string(),
  type: v.string(),
  official: v.optional(v.boolean()),
})

const image = v.object({
  filePath: v.string(),
  width: v.number(),
  height: v.number(),
})

const recommendation = v.object({
  tmdbId: v.number(),
  mediaType: v.union(v.literal("movie"), v.literal("tv")),
  title: v.string(),
  releaseDate: v.optional(v.string()),
  rating: v.optional(v.number()),
  posterPath: v.optional(v.string()),
  backdropPath: v.optional(v.string()),
})

const videoServer = v.union(v.literal("vidlove"), v.literal("vidapi"), v.literal("cdnm"), v.literal("nontongo"))

export default defineSchema({
  titles: defineTable({
    tmdbId: v.number(),
    imdbId: v.optional(v.string()),
    mediaType: v.union(v.literal("movie"), v.literal("tv")),
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
    trailers: v.optional(v.array(trailer)),
    images: v.optional(v.array(image)),
    recommendations: v.optional(v.array(recommendation)),
    updatedAt: v.number(),
  }).index("by_tmdb_media", ["tmdbId", "mediaType"]),
  seasons: defineTable({
    tmdbId: v.number(),
    seasonNumber: v.number(),
    name: v.string(),
    overview: v.string(),
    episodeCount: v.number(),
    episodes: v.array(episode),
    updatedAt: v.number(),
  }).index("by_tmdb_season", ["tmdbId", "seasonNumber"]),
  discoveryCache: defineTable({
    key: v.string(),
    mediaType: v.optional(v.union(v.literal("movie"), v.literal("tv"))),
    payload: v.any(),
    expiresAt: v.number(),
  }).index("by_key", ["key"]),
  watchPartyRooms: defineTable({
    tmdbId: v.number(),
    imdbId: v.optional(v.string()),
    mediaType: v.union(v.literal("movie"), v.literal("tv")),
    seasonNumber: v.optional(v.number()),
    episodeNumber: v.optional(v.number()),
    server: videoServer,
    hostUserId: v.string(),
    hostSessionId: v.string(),
    hostTokenHash: v.string(),
    createdAt: v.number(),
    lastEventAt: v.number(),
    expiresAt: v.number(),
  }).index("by_expires_at", ["expiresAt"]),
  watchPartyPlayback: defineTable({
    roomId: v.id("watchPartyRooms"),
    isPlaying: v.boolean(),
    positionSeconds: v.number(),
    positionUpdatedAt: v.number(),
    revision: v.number(),
    pendingRequest: v.optional(v.object({
      requestId: v.string(),
      userId: v.string(),
      username: v.string(),
      isPlaying: v.boolean(),
      positionSeconds: v.number(),
      createdAt: v.number(),
    })),
    updatedAt: v.number(),
  }).index("by_room_id", ["roomId"]),
  watchPartyMessages: defineTable({
    roomId: v.id("watchPartyRooms"),
    userId: v.string(),
    username: v.string(),
    body: v.string(),
    createdAt: v.number(),
  }).index("by_room_and_created_at", ["roomId", "createdAt"]),
  watchPartyPresence: defineTable({
    roomId: v.id("watchPartyRooms"),
    userId: v.string(),
    username: v.string(),
    sessionId: v.string(),
    lastSeenAt: v.number(),
  }).index("by_room_and_user", ["roomId", "userId"])
    .index("by_room_and_last_seen", ["roomId", "lastSeenAt"]),
})
