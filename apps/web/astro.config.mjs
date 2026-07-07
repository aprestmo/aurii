import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

const site = process.env.ASTRO_SITE ?? "http://localhost:4322";
const base = process.env.ASTRO_BASE ?? "/";

export default defineConfig({
  site,
  base,
  output: "static",
  server: { port: 4322 },
  vite: {
    plugins: [tailwindcss()],
  },
});
