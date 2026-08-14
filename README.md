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

The iOS platform is included in this repository. Open `ios/App/App.xcodeproj` in Xcode after syncing, select a simulator or signed device, and run the `App` scheme. A simulator build can also be validated without signing:

```bash
xcodebuild -project ios/App/App.xcodeproj -scheme App -sdk iphonesimulator -configuration Debug -derivedDataPath build/ios CODE_SIGNING_ALLOWED=NO build
```

The MovieLand app icon source lives at `resources/icon.png` and is expanded into the iOS asset catalog with `bunx @capacitor/assets generate --ios`.

The iframe on the watch route is a dummy embed. Its surrounding transport controls demonstrate the VLC-inspired interface, but cross-origin iframe playback controls remain owned by the embedded provider.

### Embedded player ads

MovieLand cannot reliably remove advertisements from VidAPI, CDNM, or NontonGo iframes because they are cross-origin providers. The parent app cannot inspect or rewrite their DOM, and a generic network blocklist can break playback or miss server-side ads. The safe options are an official ad-free provider endpoint, a licensed playback provider, or an optional future native `WKContentRuleList` for known tracker hosts with clear user-facing limitations.

## Data and attribution

TMDB supplies the catalog metadata and artwork. IMDb IDs are retained when TMDB returns them and are rendered as outbound links. The app does not scrape IMDb or third-party streaming sites. Keep TMDB and IMDb attribution visible in public deployments and review the providers' current usage terms before launch.
