import React from "react"
import ReactDOM from "react-dom/client"
import { ConvexProvider } from "convex/react"
import { BrowserRouter } from "react-router-dom"
import { hydrateRoot } from "react-dom/client"
import { AppWithCatalogData } from "./App"
import type { ServerCatalogData } from "./lib/catalog-data"
import { convexReactClient } from "./lib/convex"
import "./styles.css"

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <AppWithCatalogData data={JSON.parse(document.getElementById("movieland-data")?.textContent ?? "{}") as ServerCatalogData} />
    </BrowserRouter>
  </React.StrictMode>
)

const root = document.getElementById("root")!
const tree = convexReactClient ? <ConvexProvider client={convexReactClient}>{app}</ConvexProvider> : app
if (root.childElementCount) hydrateRoot(root, tree)
else ReactDOM.createRoot(root).render(tree)
