# Downloads on Convex and Vercel

MovieLand uses VidLove for playback. Other video providers are hidden; old provider links and Watchparty records play through VidLove.

The frontend is server-rendered on Vercel. Convex stores supported file sources and private device download history. The browser or iOS downloader transfers files directly. There is no Chromium, FFmpeg, download worker, server media relay, or server-side stream capture.

## Current availability

VidLove's embed includes `download=true`, which enables its own download panel where the provider offers it. MovieLand cannot access that panel's file URLs through the cross-origin iframe.

No verified official VidLove direct-file API is configured. Until an operator registers a supported file, MovieLand's download button reports “Download unavailable” and suggests the player's own download option. Unsupported streams do not create queued jobs.

## Configure hosting

1. Deploy the Convex functions and schema to your production deployment.
2. Set `TMDB_READ_ACCESS_TOKEN` or `TMDB_API_KEY` in that Convex deployment.
3. Set `VITE_CONVEX_URL` and `CONVEX_URL` to the production Convex URL in Vercel. `VITE_CONVEX_URL` must be present during the build.
4. Use the existing `vercel.json`, build command `bun run build`, and `dist/client` output directory.
5. Register supported files as described below. No download-worker environment variables are needed.

## Register a supported file

`downloads:registerSource` is an **internal mutation** available to operators through the Convex dashboard or authenticated CLI. It is not a public browser API. Registry entries are associated with VidLove movie IDs or exact TV season/episode selections. Registration does not scrape VidLove or extract a stream.

For a provider-issued direct file:

```sh
bunx convex run downloads:registerSource '{"tmdbId":27205,"mediaType":"movie","title":"Inception","fileName":"Inception.mp4","contentType":"video/mp4","fileUrl":"https://your-provider.example/official-download.mp4","enabled":true}'
```

`downloads:unregisterSource` removes a source registration. Its optional `deleteStoredFile:true` also deletes the associated Convex Storage file, provided no other source references it. History is retained until removed or expired, and subsequent opens report unavailable.

The URL above is a placeholder. Use a real authorized direct-file URL that accepts browser navigation without secret authorization headers, player-session cookies, or a server-side proxy. Configure `expiresAt` as Unix milliseconds for expiring provider links, and update the registry when links change. Mark a source `enabled:false` to stop further handoffs. Operators are responsible for verifying external URLs return the declared video file, not HTML or redirects to a player page.

To keep hosted media entirely on Convex, upload your video through the Convex dashboard Storage page and use its storage ID. Operators can also call the internal `downloads:createUploadUrl` mutation and POST the file to that URL with its video content type. Treat the returned upload URL as temporary and private.

```sh
bunx convex run downloads:registerSource '{"tmdbId":27205,"mediaType":"movie","title":"Inception","fileName":"Inception.mp4","contentType":"video/mp4","storageId":"YOUR_STORAGE_ID","enabled":true}'
```

Use exactly one of `fileUrl` or `storageId`. Convex Storage files must have matching `video/mp4` or `video/webm` metadata and a nonzero size. For episodes, also supply positive integer `seasonNumber` and `episodeNumber`. Source registration is a trusted operator action, not an upload form for arbitrary users. CLI commands above target the configured development deployment by default. Production registration requires explicitly choosing the production deployment.

## User flow

- Request an available file from the watch page. Convex creates or updates one history entry for that title or episode.
- Open Downloads and select its download icon. The app rechecks the source and obtains its current URL before opening it in a new browser tab.
- File saving and progress depend on the browser and the provider's response headers. A provider that serves inline video may open its player; use the browser's save control. Cross-origin `download` attributes cannot force an attachment reliably.
- History says “File available” or “Opened in browser”. MovieLand cannot observe completion, pause, cancellation, or transfer speed in the browser's download manager.
- iOS retains its direct-file downloader, with actual native progress. Android uses the browser handoff when native downloading is unavailable.

## History and access

A 256-bit random device capability is stored in local storage and sent to Convex over HTTPS. Convex stores only its SHA-256 digest. Every list, open, remove, and clear operation checks capability ownership. This is anonymous device access, not account authentication or entitlement verification. Clearing site data loses access to that device's previous history.

History contains no media URL or capability and is limited to 100 entries per device. Entries expire after seven days and an hourly cleanup removes them. Removing history does not delete a provider's file, a shared Convex Storage file, or a file the browser already saved. Convex Storage download URLs are bearer links. This implementation is for files that may be shared via links, not account-restricted paid content.

Legacy local worker entries are marked unavailable and can be removed. Existing worker files under `.movieland-downloads/` remain untouched on disk; they are no longer served by the app.

## Verification

```sh
bun run test:downloads
bun run build
bunx tsc -p convex/tsconfig.json
```

The Bun suite uses `convex-test` for real registered query and mutation handlers against a mock database. It covers unavailable sources, ownership, deduplication, source updates/revocation/expiry, Convex Storage, validation, exact episode lookup, deletion, cleanup, bounded history, and VidLove-only playback. It does not prove a live VidLove direct-file API exists.
