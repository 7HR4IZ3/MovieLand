import type { VercelRequest, VercelResponse } from "@vercel/node"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { ServerCatalogData } from "../src/lib/catalog-data"

const template = await readFile(resolve(process.cwd(), "dist/client/index.html"), "utf8")

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const { render } = await import("../dist/server/entry-server.js" as string)
  const { loadServerCatalogData } = await import("../dist/server/catalog-server.js" as string)
  const requestUrl = new URL(request.url ?? "/", `https://${request.headers.host ?? "localhost"}`)
  let data: ServerCatalogData = {}
  try {
    data = await loadServerCatalogData(requestUrl)
  } catch (error) {
    console.error("SSR catalog request failed", error)
  }
  const html = render(`${requestUrl.pathname}${requestUrl.search}`, data)
  const title = data.title ? `${data.title.title} | MovieLand` : "MovieLand"
  const description = data.title?.overview ?? "Discover movies and series on MovieLand."
  const escaped = JSON.stringify(data).replace(/</g, "\\u003c")
  response.setHeader("Content-Type", "text/html; charset=utf-8")
  response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
  response.status(200).send(template
    .replace("<!--ssr-outlet-->", html)
    .replace('<script id="movieland-data" type="application/json">{}</script>', `<script id="movieland-data" type="application/json">${escaped}</script>`)
    .replace("<title>MovieLand</title><!--ssr-head-->", `<meta name="description" content="${escapeAttribute(description)}" /><title>${escapeAttribute(title)}</title>`))
}

function escapeAttribute(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)
}
