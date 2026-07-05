import { resolve } from "path";
export default {
  base: "/low-poly-worlds/musashi-homepage/",
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), island: resolve(__dirname, "island.html") },
    },
  },
};
