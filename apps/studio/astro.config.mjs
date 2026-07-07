import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

const isGithubPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  output: "static",
  server: { port: 4321 },
  ...(isGithubPages ? {} : { adapter: node({ mode: "standalone" }) }),
  site: process.env.ASTRO_SITE,
  base: process.env.ASTRO_BASE,
  vite: {
    plugins: [tailwindcss()],
  },
});
