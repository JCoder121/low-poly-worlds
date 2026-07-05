import { resolve } from "path";

export default {
  base: "/low-poly-worlds/sparrows-wake/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        island: resolve(__dirname, "island.html"),
      },
    },
  },
};
