# MovieLand

MovieLand is a React + Vite + Tailwind + Capacitor movie discovery shell backed by Convex and TMDB. It includes local fixture data so the UI can be explored before a Convex deployment is connected.

## Local development

```bash
bun install
bun run dev
```

With no `VITE_CONVEX_URL`, the app uses the fixture catalog in `src/lib/fixtures.ts`.

## Connect Convex and TMDB

1. Create or select a Convex deployment and run `bunx convex dev` from this directory.
2. Add the TMDB credential to the Convex deployment, never to `.env` or `src/`:

```bash
bunx convex env set TMDB_READ_ACCESS_TOKEN your_tmdb_read_access_token
```

`TMDB_API_KEY` is also supported by the adapter if you prefer the v3 API key flow.

3. Put the public Convex deployment URL in `.env.local`:

```bash
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

4. Run `bun run dev` again. The UI will use Convex catalog actions and fall back to fixtures if a request fails.

Convex code generation is performed by `bunx convex dev` or `bunx convex codegen` after a deployment is configured. The generated `convex/_generated/` directory is intentionally not hand-authored.

## Capacitor

Build the web bundle and synchronize it into native projects after adding a platform:

```bash
bun run build
bunx cap add ios
bunx cap add android
bun run cap:sync
```

The iframe on the watch route is a dummy embed. Its surrounding transport controls demonstrate the VLC-inspired interface, but cross-origin iframe playback controls remain owned by the embedded provider.

## Data and attribution

TMDB supplies the catalog metadata and artwork. IMDb IDs are retained when TMDB returns them and are rendered as outbound links. The app does not scrape IMDb or third-party streaming sites. Keep TMDB and IMDb attribution visible in public deployments and review the providers' current usage terms before launch.
