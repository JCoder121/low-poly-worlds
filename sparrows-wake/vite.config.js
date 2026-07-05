import { resolve } from "path";

export default {
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        island: resolve(__dirname, "island.html"),
      },
    },
  },
};
