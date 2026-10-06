import { afterAll, beforeAll, expect, test } from "bun:test"
import { createServer, type ViteDevServer } from "vite"
import type { ServerCatalogData } from "../src/lib/catalog-data"
import { fixtureCatalog, fixtureSeasons, getFixtureTitle } from "../src/lib/fixtures"

let vite: ViteDevServer
let render: (url: string, data: ServerCatalogData) => string
let load: (url: URL) => Promise<ServerCatalogData>
const originalConvexUrl = process.env.CONVEX_URL

beforeAll(async () => {
  // Keep HTML regression checks independent of live catalog availability.
  process.env.CONVEX_URL = " "
  vite = await createServer({
    configFile: "vite.config.ts",
    server: { middlewareMode: true, hmr: false },
    cacheDir: "node_modules/.vite-no-js-tests",
    appType: "custom",
    define: { "import.meta.env.VITE_CONVEX_URL": JSON.stringify("") },
  })
  render = (await vite.ssrLoadModule("/src/entry-server.tsx")).render
  load = (await vite.ssrLoadModule("/src/lib/catalog-server.ts")).loadServerCatalogData
}, 30000)

afterAll(async () => {
  await vite?.close()
  if (originalConvexUrl === undefined) delete process.env.CONVEX_URL
  else process.env.CONVEX_URL = originalConvexUrl
})

test("discovery and search send content and a native search form", async () => {
  expect(render("/", { discover: fixtureCatalog })).toContain("Inception")
  const data = await load(new URL("http://localhost/search?q=Inception"))
  const html = render("/search?q=Inception", data)
  expect(html).toContain('action="/search"')
  expect(html).toContain('method="get"')
  expect(html).toContain('name="q"')
  expect(html).toContain('href="/movie/27205"')
  expect(html).not.toContain("Loading titles")
})

test("browse pages preserve page and year in native navigation", async () => {
  const url = new URL("http://localhost/browse/top-250-movies?year=2020&page=3")
  const data = await load(url)
  expect(data.browse?.page).toBe(3)
  expect(data.browse?.year).toBe(2020)
  const html = render(url.pathname + url.search, {
    browse: { ...data.browse!, totalPages: 5 },
  })
  expect(html).toContain('name="year"')
  expect(html).toContain('href="/browse/top-250-movies?year=2020&amp;page=2"')
  expect(html).toContain('href="/browse/top-250-movies?year=2020&amp;page=4"')
  expect((await load(new URL("http://localhost/browse/movies?page=-1"))).browse?.page).toBe(1)
})

test("series details and watch pages render episodes before hydration", async () => {
  for (const path of ["/series/94605", "/watch/series/94605?season=1&episode=2"]) {
    const data = await load(new URL(path, "http://localhost"))
    expect(data.title?.title).toBe("Westworld")
    expect(data.season?.seasonNumber).toBe(1)
    const html = render(path, data)
    expect(html).toContain("The Beginning")
    expect(html).toContain('name="season"')
    expect(html).toContain("episode=10")
    expect(html).not.toContain("Loading episodes")
    expect(html).not.toContain("player-loading-overlay")
  }
  const data = await load(new URL("http://localhost/series/94605?season=2"))
  expect(data.season).toBeUndefined()
  expect(render("/series/94605?season=2", data)).toContain("Episodes are unavailable")
})

test("all episodes remain accessible without a click handler", () => {
  const season = fixtureSeasons[94605]
  const html = render("/series/94605", {
    title: getFixtureTitle("tv", 94605), titleLoaded: true,
    season: { ...season, episodes: [...season.episodes, { ...season.episodes[0], id: 1011, episodeNumber: 11, name: "Episode Eleven" }] },
  })
  expect(html).toContain("Episode Eleven")
  expect(html).toContain("episode=11")
})

test("unknown titles and browser-only pages have useful fallback content", async () => {
  const data = await load(new URL("http://localhost/movie/0"))
  expect(render("/movie/0", data)).toContain("Page not found")
  for (const path of ["/my-list", "/downloads", "/watchparty", "/watchparty/example"]) {
    const html = render(path, {})
    expect(html).toContain("Enable JavaScript")
    expect(html).toContain("Browse titles")
    expect(html).not.toContain("loading-spinner")
  }
})
