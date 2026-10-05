import React from "react"
import { renderToString } from "react-dom/server"
import { ConvexProvider } from "convex/react"
import { StaticRouter } from "react-router"
import { AppWithCatalogData } from "./App"
import { convexReactClient } from "./lib/convex"
import type { ServerCatalogData } from "./lib/catalog-data"

export function render(url: string, data: ServerCatalogData) {
  const app = <React.StrictMode><StaticRouter location={url}><AppWithCatalogData data={data} /></StaticRouter></React.StrictMode>
  const tree = convexReactClient ? <ConvexProvider client={convexReactClient}>{app}</ConvexProvider> : app
  return renderToString(tree)
}
