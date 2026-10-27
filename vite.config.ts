import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  esbuild: { jsx: "automatic" },
  // GitHub Pages project site of remote 'lo': https://kiennguyenkt.github.io/sea-union/
  base: command === "build" ? "/sea-union/" : "/",
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // "use client" directive của @xyflow/react bị rollup bỏ qua khi bundle
        // ESM — vô hại (directive dành cho consumer), lọc đúng case này thôi.
        if (
          warning.code === "MODULE_LEVEL_DIRECTIVE" &&
          warning.message.includes('"use client"')
        ) {
          return;
        }
        warn(warning);
      },
      output: {
        // Tách vendor (react-dom, @xyflow/react) khỏi app code để dưới ngưỡng
        // cảnh báo 500 kB/chunk của Vite. Function-form theo path vì object-form
        // không resolve đúng module trong layout pnpm (symlink .pnpm).
        // @xyflow phải check trước các nhánh react: path package của nó
        // (@xyflow/react/) tự chứa substring "/react/".
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@xyflow")) return "xyflow";
          if (id.includes("/react-dom/") || id.includes("/react/"))
            return "react";
          if (id.includes("/scheduler/")) return "react";
          return "vendor";
        },
      },
    },
  },
}));
