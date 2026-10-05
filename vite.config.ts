import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  ssr: { noExternal: ["convex"] },
  build: {
    target: "es2022",
    rollupOptions: { input: "index.html" },
    outDir: "dist/client",
  },
})
