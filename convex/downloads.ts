import { v } from "convex/values"
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import { downloadSelection, downloadKey, downloadOwnerHash, downloadFileName, validateDirectFileUrl } from "./lib/downloads"

const selection = downloadSelection
const unavailable = "Download unavailable. Use the download option inside the VidLove player, if offered."
const historyItem = v.object({
  id: v.id("downloadHistory"),
  ...selection,
  title: v.string(),
  fileName: v.string(),
  status: v.union(v.literal("ready"), v.literal("opened")),
  createdAt: v.number(),
  updatedAt: v.number(),
})

export const createUploadUrl = internalMutation({
  args: {}, returns: v.string(),
  handler: ctx => ctx.storage.generateUploadUrl(),
})

export const unregisterSource = internalMutation({
  args: { ...selection, deleteStoredFile: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const key = downloadKey(args)
    const source = await ctx.db.query("downloadSources").withIndex("by_key", q => q.eq("key", key)).unique()
    if (!source) return null
    if (args.deleteStoredFile && source.storageId) {
      const references = await ctx.db.query("downloadSources").withIndex("by_storageId", q => q.eq("storageId", source.storageId)).take(2)
      if (references.length > 1) throw new Error("This storage file is shared by another source")
      await ctx.storage.delete(source.storageId)
    }
    await ctx.db.delete(source._id)
    return null
  },
})

function summarize(row: Doc<"downloadHistory">) {
  return { id: row._id, tmdbId: row.tmdbId, mediaType: row.mediaType, seasonNumber: row.seasonNumber, episodeNumber: row.episodeNumber, title: row.title, fileName: row.fileName, status: row.status, createdAt: row.createdAt, updatedAt: row.updatedAt }
}

async function fileLink(ctx: Pick<QueryCtx, "storage">, source: Doc<"downloadSources"> | null, now: number) {
  if (!source?.enabled || (source.expiresAt !== undefined && source.expiresAt <= now)) return null
  if (source.storageId) return ctx.storage.getUrl(source.storageId)
  return source.fileUrl ? validateDirectFileUrl(source.fileUrl) : null
}

// Administrative registration only. Browsers cannot supply or replace file URLs.
// Use the dashboard or `bunx convex run downloads:registerSource` as an operator.
export const registerSource = internalMutation({
  args: {
    ...selection,
    title: v.string(),
    fileName: v.string(),
    contentType: v.union(v.literal("video/mp4"), v.literal("video/webm")),
    fileUrl: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    expiresAt: v.optional(v.number()),
    enabled: v.boolean(),
  },
  returns: v.id("downloadSources"),
  handler: async (ctx, args) => {
    const key = downloadKey(args)
    if (Boolean(args.fileUrl) === Boolean(args.storageId)) throw new Error("Choose one direct file URL or Convex storage file")
    const title = args.title.trim().slice(0, 200)
    if (!title) throw new Error("Title is required")
    if (args.expiresAt !== undefined && (!Number.isFinite(args.expiresAt) || args.expiresAt <= Date.now())) throw new Error("Expiry must be in the future")
    if (args.storageId) {
      const metadata = await ctx.db.system.get(args.storageId)
      if (!metadata || metadata.contentType !== args.contentType || metadata.size <= 0) throw new Error("Storage file must be a nonempty video with the matching content type")
    }
    const data = { ...args, title, key, fileName: downloadFileName(args.fileName, args.contentType), fileUrl: args.fileUrl ? validateDirectFileUrl(args.fileUrl) : undefined, updatedAt: Date.now() }
    const existing = await ctx.db.query("downloadSources").withIndex("by_key", q => q.eq("key", key)).unique()
    if (existing) { await ctx.db.replace(existing._id, data); return existing._id }
    return ctx.db.insert("downloadSources", data)
  },
})

export const request = mutation({
  args: { ...selection, ownerToken: v.string() },
  returns: v.union(v.object({ available: v.literal(false), reason: v.string() }), v.object({ available: v.literal(true), item: historyItem })),
  handler: async (ctx, args) => {
    const key = downloadKey(args)
    const ownerHash = await downloadOwnerHash(args.ownerToken)
    const source = await ctx.db.query("downloadSources").withIndex("by_key", q => q.eq("key", key)).unique()
    const now = Date.now()
    if (!source || !await fileLink(ctx, source, now)) return { available: false as const, reason: unavailable }
    const existing = await ctx.db.query("downloadHistory").withIndex("by_ownerHash_and_key", q => q.eq("ownerHash", ownerHash).eq("key", key)).unique()
    const data = { ownerHash, key, sourceId: source._id, tmdbId: source.tmdbId, mediaType: source.mediaType, seasonNumber: source.seasonNumber, episodeNumber: source.episodeNumber, title: source.title, fileName: source.fileName, status: "ready" as const, createdAt: existing?.createdAt ?? now, updatedAt: now, expiresAt: now + 7 * 24 * 60 * 60 * 1000 }
    let id = existing?._id
    if (id) await ctx.db.replace(id, data)
    else {
      // Keep at most 100 entries per device. All access paths use bounded indexes.
      const history = await ctx.db.query("downloadHistory").withIndex("by_ownerHash", q => q.eq("ownerHash", ownerHash)).order("desc").take(100)
      if (history.length === 100) await ctx.db.delete(history[99]._id)
      id = await ctx.db.insert("downloadHistory", data)
    }
    return { available: true as const, item: summarize({ ...data, _id: id, _creationTime: now }) }
  },
})

export const list = query({
  args: { ownerToken: v.string() },
  returns: v.array(historyItem),
  handler: async (ctx, args) => {
    const ownerHash = await downloadOwnerHash(args.ownerToken)
    const rows = await ctx.db.query("downloadHistory").withIndex("by_ownerHash", q => q.eq("ownerHash", ownerHash)).order("desc").take(100)
    return rows.map(summarize)
  },
})

export const open = mutation({
  args: { id: v.id("downloadHistory"), ownerToken: v.string() },
  returns: v.union(v.object({ available: v.literal(false), reason: v.string() }), v.object({ available: v.literal(true), url: v.string(), fileName: v.string() })),
  handler: async (ctx, args) => {
    const ownerHash = await downloadOwnerHash(args.ownerToken)
    const row = await ctx.db.get(args.id)
    if (!row || row.ownerHash !== ownerHash) throw new Error("Download not found")
    const now = Date.now()
    const source = await ctx.db.get(row.sourceId)
    const url = row.expiresAt > now ? await fileLink(ctx, source, now) : null
    if (!url || !source) return { available: false as const, reason: unavailable }
    await ctx.db.patch(row._id, { status: "opened", fileName: source.fileName, updatedAt: now })
    // A browser handoff is not evidence that its download completed.
    return { available: true as const, url, fileName: source.fileName }
  },
})

export const remove = mutation({
  args: { id: v.id("downloadHistory"), ownerToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerHash = await downloadOwnerHash(args.ownerToken)
    const row = await ctx.db.get(args.id)
    if (row && row.ownerHash !== ownerHash) throw new Error("Download not found")
    if (row) await ctx.db.delete(row._id)
    return null
  },
})

export const clear = mutation({
  args: { ownerToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerHash = await downloadOwnerHash(args.ownerToken)
    const rows = await ctx.db.query("downloadHistory").withIndex("by_ownerHash", q => q.eq("ownerHash", ownerHash)).take(100)
    for (const row of rows) await ctx.db.delete(row._id)
    return null
  },
})

export const cleanupExpired = internalMutation({
  args: {}, returns: v.null(),
  handler: async ctx => {
    const rows = await ctx.db.query("downloadHistory").withIndex("by_expiresAt", q => q.lte("expiresAt", Date.now())).take(100)
    for (const row of rows) await ctx.db.delete(row._id)
    if (rows.length === 100) await ctx.scheduler.runAfter(0, internal.downloads.cleanupExpired, {})
    return null
  },
})
