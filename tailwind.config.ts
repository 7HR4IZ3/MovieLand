import type { Config } from "tailwindcss"

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#101216",
          900: "#14171c",
          850: "#181c22",
          800: "#1c2026",
          700: "#2b3038",
          500: "#747b86",
          300: "#b6bbc2",
          100: "#e6e8ea",
        },
        ember: {
          500: "#c98a3d",
          400: "#e0a85b",
        },
      },
      fontFamily: {
        sans: ["Avenir Next", "Helvetica Neue", "sans-serif"],
        display: ["Baskerville", "Georgia", "serif"],
      },
      boxShadow: {
        player: "0 18px 48px rgba(0, 0, 0, 0.28)",
      },
    },
  },
  plugins: [],
} satisfies Config
