import { v } from "convex/values"
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"

const mediaType = v.union(v.literal("movie"), v.literal("tv"))
const videoServer = v.union(v.literal("vidlove"), v.literal("vidapi"), v.literal("cdnm"), v.literal("nontongo"))

const roomSummary = v.object({
  roomId: v.id("watchPartyRooms"),
  tmdbId: v.number(),
  imdbId: v.optional(v.string()),
  mediaType,
  seasonNumber: v.optional(v.number()),
  episodeNumber: v.optional(v.number()),
  server: videoServer,
  hostUserId: v.string(),
  hostSessionId: v.string(),
  createdAt: v.number(),
  expiresAt: v.number(),
})

const pendingRequest = v.object({
  requestId: v.string(),
  userId: v.string(),
  username: v.string(),
  isPlaying: v.boolean(),
  positionSeconds: v.number(),
  createdAt: v.number(),
})

const playbackSummary = v.object({
  isPlaying: v.boolean(),
  positionSeconds: v.number(),
  positionUpdatedAt: v.number(),
  revision: v.number(),
  pendingRequest: v.optional(pendingRequest),
  updatedAt: v.number(),
})

const messageSummary = v.object({
  userId: v.string(),
  username: v.string(),
  body: v.string(),
  createdAt: v.number(),
})

const memberSummary = v.object({
  userId: v.string(),
  username: v.string(),
  lastSeenAt: v.number(),
})

const roomResponse = v.object({
  room: roomSummary,
  playback: v.union(playbackSummary, v.null()),
  members: v.array(memberSummary),
})

function cleanUsername(input: string) {
  const username = input.trim().slice(0, 32)
  if (!username) throw new Error("A username is required")
  return username
}

function cleanUserId(input: string) {
  const userId = input.trim()
  if (!userId || userId.length > 120) throw new Error("A valid temporary userid is required")
  return userId
}

function cleanSessionId(input: string) {
  const sessionId = input.trim()
  if (!sessionId || sessionId.length > 160) throw new Error("A valid room session is required")
  return sessionId
}

function cleanTokenHash(input: string) {
  const tokenHash = input.trim()
  if (!tokenHash || tokenHash.length > 200) throw new Error("A valid room token is required")
  return tokenHash
}

function cleanRoom(room: Doc<"watchPartyRooms"> | null) {
  if (!room) throw new Error("That Watchparty room does not exist")
  if (room.expiresAt <= Date.now()) throw new Error("That Watchparty room has expired")
  return room
}

function roomExpiry(now: number) {
  return now + 24 * 60 * 60 * 1000
}

async function touchRoom(ctx: MutationCtx, room: Doc<"watchPartyRooms">, now: number) {
  await ctx.db.patch(room._id, { lastEventAt: now, expiresAt: roomExpiry(now) })
}

export const createRoom = mutation({
  args: {
    tmdbId: v.number(),
    imdbId: v.optional(v.string()),
    mediaType,
    seasonNumber: v.optional(v.number()),
    episodeNumber: v.optional(v.number()),
    server: videoServer,
    userId: v.string(),
    username: v.string(),
    sessionId: v.string(),
    hostTokenHash: v.string(),
  },
  returns: v.object({ roomId: v.id("watchPartyRooms") }),
  handler: async (ctx, args) => {
    if (args.mediaType === "tv" && (!Number.isInteger(args.seasonNumber) || !Number.isInteger(args.episodeNumber))) {
      throw new Error("A season and episode are required for a series room")
    }
    const now = Date.now()
    const userId = cleanUserId(args.userId)
    const username = cleanUsername(args.username)
    const sessionId = cleanSessionId(args.sessionId)
    const hostTokenHash = cleanTokenHash(args.hostTokenHash)
    const roomId = await ctx.db.insert("watchPartyRooms", {
      tmdbId: args.tmdbId,
      imdbId: args.imdbId,
      mediaType: args.mediaType,
      seasonNumber: args.seasonNumber,
      episodeNumber: args.episodeNumber,
      server: args.server,
      hostUserId: userId,
      hostSessionId: sessionId,
      hostTokenHash,
      createdAt: now,
      lastEventAt: now,
      expiresAt: roomExpiry(now),
    })
    await ctx.db.insert("watchPartyPlayback", {
      roomId,
      isPlaying: false,
      positionSeconds: 0,
      positionUpdatedAt: now,
      revision: 0,
      updatedAt: now,
    })
    await ctx.db.insert("watchPartyPresence", { roomId, userId, username, sessionId, lastSeenAt: now })
    return { roomId }
  },
})

export const getRoom = query({
  args: { roomId: v.id("watchPartyRooms") },
  returns: v.union(roomResponse, v.null()),
  handler: async (ctx, args) => {
    const storedRoom = await ctx.db.get(args.roomId)
    if (!storedRoom || storedRoom.expiresAt <= Date.now()) return null
    const playback = await ctx.db.query("watchPartyPlayback").withIndex("by_room_id", (q) => q.eq("roomId", args.roomId)).unique()
    const activeSince = Date.now() - 90 * 1000
    const members = await ctx.db.query("watchPartyPresence").withIndex("by_room_and_last_seen", (q) => q.eq("roomId", args.roomId).gt("lastSeenAt", activeSince)).take(50)
    return {
      room: {
        roomId: storedRoom._id,
        tmdbId: storedRoom.tmdbId,
        imdbId: storedRoom.imdbId,
        mediaType: storedRoom.mediaType,
        seasonNumber: storedRoom.seasonNumber,
        episodeNumber: storedRoom.episodeNumber,
        server: storedRoom.server,
        hostUserId: storedRoom.hostUserId,
        hostSessionId: storedRoom.hostSessionId,
        createdAt: storedRoom.createdAt,
        expiresAt: storedRoom.expiresAt,
      },
      playback: playback ? {
        isPlaying: playback.isPlaying,
        positionSeconds: playback.positionSeconds,
        positionUpdatedAt: playback.positionUpdatedAt,
        revision: playback.revision,
        pendingRequest: playback.pendingRequest,
        updatedAt: playback.updatedAt,
      } : null,
      members: members.map((member) => ({ userId: member.userId, username: member.username, lastSeenAt: member.lastSeenAt })),
    }
  },
})

export const joinRoom = mutation({
  args: { roomId: v.id("watchPartyRooms"), userId: v.string(), username: v.string(), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = cleanRoom(await ctx.db.get(args.roomId))
    const userId = cleanUserId(args.userId)
    const username = cleanUsername(args.username)
    const sessionId = cleanSessionId(args.sessionId)
    const now = Date.now()
    const existing = await ctx.db.query("watchPartyPresence").withIndex("by_room_and_user", (q) => q.eq("roomId", args.roomId).eq("userId", userId)).unique()
    if (existing) await ctx.db.patch(existing._id, { username, sessionId, lastSeenAt: now })
    else await ctx.db.insert("watchPartyPresence", { roomId: args.roomId, userId, username, sessionId, lastSeenAt: now })
    await touchRoom(ctx, room, now)
    return null
  },
})

export const heartbeat = mutation({
  args: { roomId: v.id("watchPartyRooms"), userId: v.string(), username: v.string(), sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = cleanRoom(await ctx.db.get(args.roomId))
    const userId = cleanUserId(args.userId)
    const username = cleanUsername(args.username)
    const sessionId = cleanSessionId(args.sessionId)
    const now = Date.now()
    const existing = await ctx.db.query("watchPartyPresence").withIndex("by_room_and_user", (q) => q.eq("roomId", args.roomId).eq("userId", userId)).unique()
    if (existing) await ctx.db.patch(existing._id, { username, sessionId, lastSeenAt: now })
    else await ctx.db.insert("watchPartyPresence", { roomId: args.roomId, userId, username, sessionId, lastSeenAt: now })
    await touchRoom(ctx, room, now)
    return null
  },
})

export const listMessages = query({
  args: { roomId: v.id("watchPartyRooms") },
  returns: v.array(messageSummary),
  handler: async (ctx, args) => {
    const messages = await ctx.db.query("watchPartyMessages").withIndex("by_room_and_created_at", (q) => q.eq("roomId", args.roomId)).order("desc").take(100)
    return messages.reverse().map((message) => ({ userId: message.userId, username: message.username, body: message.body, createdAt: message.createdAt }))
  },
})

export const sendMessage = mutation({
  args: { roomId: v.id("watchPartyRooms"), userId: v.string(), username: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = cleanRoom(await ctx.db.get(args.roomId))
    const body = args.body.trim().slice(0, 500)
    if (!body) throw new Error("Message cannot be empty")
    const now = Date.now()
    await ctx.db.insert("watchPartyMessages", { roomId: args.roomId, userId: cleanUserId(args.userId), username: cleanUsername(args.username), body, createdAt: now })
    await touchRoom(ctx, room, now)
    return null
  },
})

export const requestPlayback = mutation({
  args: { roomId: v.id("watchPartyRooms"), userId: v.string(), username: v.string(), requestId: v.string(), isPlaying: v.boolean(), positionSeconds: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = cleanRoom(await ctx.db.get(args.roomId))
    const playback = await ctx.db.query("watchPartyPlayback").withIndex("by_room_id", (q) => q.eq("roomId", args.roomId)).unique()
    if (!playback) throw new Error("Playback state is not ready")
    const now = Date.now()
    await ctx.db.patch(playback._id, {
      pendingRequest: {
        requestId: args.requestId,
        userId: cleanUserId(args.userId),
        username: cleanUsername(args.username),
        isPlaying: args.isPlaying,
        positionSeconds: Math.max(0, args.positionSeconds),
        createdAt: now,
      },
      updatedAt: now,
    })
    await touchRoom(ctx, room, now)
    return null
  },
})

export const applyPlaybackRequest = mutation({
  args: { roomId: v.id("watchPartyRooms"), hostTokenHash: v.string(), requestId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = cleanRoom(await ctx.db.get(args.roomId))
    if (cleanTokenHash(args.hostTokenHash) !== room.hostTokenHash) throw new Error("Only the active host can apply playback state")
    const playback = await ctx.db.query("watchPartyPlayback").withIndex("by_room_id", (q) => q.eq("roomId", args.roomId)).unique()
    if (!playback?.pendingRequest || playback.pendingRequest.requestId !== args.requestId) return null
    const now = Date.now()
    await ctx.db.replace(playback._id, {
      roomId: args.roomId,
      isPlaying: playback.pendingRequest.isPlaying,
      positionSeconds: Math.max(0, playback.pendingRequest.positionSeconds),
      positionUpdatedAt: now,
      revision: playback.revision + 1,
      updatedAt: now,
    })
    await touchRoom(ctx, room, now)
    return null
  },
})

export const syncPlayback = mutation({
  args: { roomId: v.id("watchPartyRooms"), hostTokenHash: v.string(), isPlaying: v.boolean(), positionSeconds: v.number(), revision: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = cleanRoom(await ctx.db.get(args.roomId))
    if (cleanTokenHash(args.hostTokenHash) !== room.hostTokenHash) throw new Error("Only the active host can broadcast playback position")
    const playback = await ctx.db.query("watchPartyPlayback").withIndex("by_room_id", (q) => q.eq("roomId", args.roomId)).unique()
    if (!playback || playback.revision !== args.revision) return null
    const now = Date.now()
    await ctx.db.patch(playback._id, {
      isPlaying: args.isPlaying,
      positionSeconds: Math.max(0, args.positionSeconds),
      positionUpdatedAt: now,
      updatedAt: now,
    })
    await touchRoom(ctx, room, now)
    return null
  },
})

export const setServer = mutation({
  args: { roomId: v.id("watchPartyRooms"), hostTokenHash: v.string(), server: videoServer },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = cleanRoom(await ctx.db.get(args.roomId))
    if (cleanTokenHash(args.hostTokenHash) !== room.hostTokenHash) throw new Error("Only the active host can change the server")
    await touchRoom(ctx, room, Date.now())
    await ctx.db.patch(room._id, { server: args.server })
    return null
  },
})

export const claimHost = mutation({
  args: { roomId: v.id("watchPartyRooms"), userId: v.string(), username: v.string(), sessionId: v.string(), hostTokenHash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = cleanRoom(await ctx.db.get(args.roomId))
    const userId = cleanUserId(args.userId)
    const username = cleanUsername(args.username)
    const sessionId = cleanSessionId(args.sessionId)
    const hostPresence = await ctx.db.query("watchPartyPresence").withIndex("by_room_and_user", (q) => q.eq("roomId", args.roomId).eq("userId", room.hostUserId)).unique()
    if (hostPresence && hostPresence.lastSeenAt > Date.now() - 10 * 60 * 1000) throw new Error("The current host is still active")
    const claimant = await ctx.db.query("watchPartyPresence").withIndex("by_room_and_user", (q) => q.eq("roomId", args.roomId).eq("userId", userId)).unique()
    if (!claimant) throw new Error("Join the room before claiming host")
    const now = Date.now()
    await ctx.db.patch(room._id, { hostUserId: userId, hostSessionId: sessionId, hostTokenHash: cleanTokenHash(args.hostTokenHash), lastEventAt: now, expiresAt: roomExpiry(now) })
    await ctx.db.patch(claimant._id, { username, sessionId, lastSeenAt: now })
    return null
  },
})

export const cleanupExpired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const rooms = await ctx.db.query("watchPartyRooms").withIndex("by_expires_at", (q) => q.lte("expiresAt", Date.now())).take(10)
    for (const room of rooms) await ctx.scheduler.runAfter(0, internal.watchParty.cleanupRoom, { roomId: room._id })
    return null
  },
})

export const cleanupRoom = internalMutation({
  args: { roomId: v.id("watchPartyRooms") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) return null
    const messages = await ctx.db.query("watchPartyMessages").withIndex("by_room_and_created_at", (q) => q.eq("roomId", args.roomId)).take(100)
    const presence = await ctx.db.query("watchPartyPresence").withIndex("by_room_and_user", (q) => q.eq("roomId", args.roomId)).take(100)
    for (const message of messages) await ctx.db.delete(message._id)
    for (const member of presence) await ctx.db.delete(member._id)
    const playback = await ctx.db.query("watchPartyPlayback").withIndex("by_room_id", (q) => q.eq("roomId", args.roomId)).unique()
    if (playback) await ctx.db.delete(playback._id)
    const remainingMessage = await ctx.db.query("watchPartyMessages").withIndex("by_room_and_created_at", (q) => q.eq("roomId", args.roomId)).take(1)
    const remainingPresence = await ctx.db.query("watchPartyPresence").withIndex("by_room_and_user", (q) => q.eq("roomId", args.roomId)).take(1)
    if (remainingMessage.length || remainingPresence.length) await ctx.scheduler.runAfter(0, internal.watchParty.cleanupRoom, { roomId: args.roomId })
    else await ctx.db.delete(room._id)
    return null
  },
})
