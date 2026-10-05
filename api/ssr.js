import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { render } from "../dist/server/entry-server.js";
import { loadServerCatalogData } from "../dist/server/catalog-server.js";
const template = await readFile(resolve(process.cwd(), "dist/client/index.html"), "utf8");
export default async function handler(request, response) {
    const requestUrl = new URL(request.url ?? "/", `https://${request.headers.host ?? "localhost"}`);
    let data = {};
    try {
        data = await loadServerCatalogData(requestUrl);
    }
    catch (error) {
        console.error("SSR catalog request failed", error);
    }
    const html = render(`${requestUrl.pathname}${requestUrl.search}`, data);
    const title = data.title ? `${data.title.title} | MovieLand` : "MovieLand";
    const description = data.title?.overview ?? "Discover movies and series on MovieLand.";
    const escaped = JSON.stringify(data).replace(/</g, "\\u003c");
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    response.status(200).send(template
        .replace("<!--ssr-outlet-->", html)
        .replace("<!--ssr-data-->", escaped)
        .replace("<!--ssr-head-->", `<meta name="description" content="${escapeAttribute(description)}" /><title>${escapeAttribute(title)}</title>`));
}
function escapeAttribute(value) {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
