import { resolve } from "path";

export default {
  base: "/low-poly-worlds/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        offworld: resolve(__dirname, "off-world.html"),
      },
    },
  },
};
