import { resolve } from "path";
export default {
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, "index.html"), expanse: resolve(__dirname, "expanse.html") },
    },
  },
};
