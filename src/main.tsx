import React from "react"
import ReactDOM from "react-dom/client"
import { ConvexProvider } from "convex/react"
import { BrowserRouter } from "react-router-dom"
import App from "./App"
import { convexReactClient } from "./lib/convex"
import "./styles.css"

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

ReactDOM.createRoot(document.getElementById("root")!).render(
  convexReactClient ? <ConvexProvider client={convexReactClient}>{app}</ConvexProvider> : app,
)
