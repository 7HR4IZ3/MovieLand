import { readFile } from "node:fs/promises"
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http"
import { extname, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"
import { createServer as createViteServer } from "vite"
import type { ServerCatalogData } from "./src/lib/catalog-server"

const isProduction = process.env.NODE_ENV === "production"
const root = process.cwd()
const vite = isProduction ? null : await createViteServer({ configFile: "vite.config.ts", server: { middlewareMode: true }, appType: "custom" })
const template = isProduction
  ? await readFile(resolve(root, "dist/client/index.html"), "utf8")
  : ""

async function renderRequest(requestUrl: string) {
  const url = new URL(requestUrl, "http://localhost")
  const htmlTemplate = isProduction ? template : await readFile(resolve(root, "index.html"), "utf8")
  const load = isProduction
    ? await import(pathToFileURL(resolve(root, "dist/server/entry-server.js")).href)
    : await vite!.ssrLoadModule("/src/entry-server.tsx")
  const catalogModule = isProduction
    ? await import(pathToFileURL(resolve(root, "dist/server/catalog-server.js")).href)
    : await vite!.ssrLoadModule("/src/lib/catalog-server.ts")
  let data: ServerCatalogData = {}
  try {
    data = await catalogModule.loadServerCatalogData(url)
  } catch (error) {
    console.error("SSR catalog request failed", error)
  }
  const rendered = load.render(`${url.pathname}${url.search}`, data)
  const serializedData = JSON.stringify(data).replace(/</g, "\\u003c")
  const title = data.title ? `${data.title.title} | MovieLand` : "MovieLand"
  const description = data.title?.overview ?? "Discover movies and series on MovieLand."
  return htmlTemplate
    .replace("<!--ssr-outlet-->", rendered)
    .replace('<script id="movieland-data" type="application/json">{}</script>', `<script id="movieland-data" type="application/json">${serializedData}</script>`)
    .replace("<title>MovieLand</title><!--ssr-head-->", `<meta name="description" content="${escapeHtml(description)}" /><title>${escapeHtml(title)}</title>`)
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
}

const handleRequest = async (request: IncomingMessage, response: ServerResponse) => {
  try {
    const requestUrl = request.url ?? "/"
    if (isProduction && requestUrl.startsWith("/assets/")) {
      const filePath = resolve(root, "dist/client", `.${decodeURIComponent(new URL(requestUrl, "http://localhost").pathname)}`)
      const assetRoot = resolve(root, "dist/client", "assets") + sep
      if (!filePath.startsWith(assetRoot)) {
        response.statusCode = 400
        response.end("Bad asset path")
        return
      }
      const contentTypes: Record<string, string> = { ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" }
      response.setHeader("Content-Type", contentTypes[extname(filePath)] ?? "application/octet-stream")
      response.end(await readFile(filePath))
      return
    }
    const html = await renderRequest(requestUrl)
    response.statusCode = 200
    response.setHeader("Content-Type", "text/html; charset=utf-8")
    response.end(vite ? await vite.transformIndexHtml(requestUrl, html) : html)
  } catch (error) {
    if (vite) vite.ssrFixStacktrace(error as Error)
    console.error(error)
    response.statusCode = 500
    response.end("Server rendering failed")
  }
}

const server = createHttpServer((request, response) => {
  if (vite) vite.middlewares(request, response, () => { void handleRequest!(request, response) })
  else void handleRequest!(request, response)
})
server.listen(Number(process.env.PORT) || 5173, "0.0.0.0", () => console.log("MovieLand SSR server ready"))
