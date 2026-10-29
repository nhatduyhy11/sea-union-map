import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ command, mode }) => {
  const isAnalyze = mode === "analyze";

  return {
    plugins: [
      isAnalyze &&
        visualizer({
          filename: "dist/stats.html",
          open: false,
          gzipSize: true,
          brotliSize: true,
        }),
    ].filter(Boolean),
    esbuild: { jsx: "automatic" },
    // Tự động nhận diện base path:
    // 1. Ưu tiên BASE_URL nếu được truyền từ CLI/script.
    // 2. Trên GitHub Actions: tự động lấy /<repo-name>/ từ biến GITHUB_REPOSITORY.
    // 3. Khi build local không có env: dùng './' (relative) để chạy được ở mọi path.
    base:
      command === "build"
        ? (process.env.BASE_URL ??
          (process.env.GITHUB_REPOSITORY
            ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/`
            : "./"))
        : "/",
    build: {
      target: "es2022",
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
          // Tách vendor (react-dom, @xyflow/react) và data (sea-live.json) khỏi app code.
          // Function-form theo path vì object-form không resolve đúng module trong layout pnpm (symlink .pnpm).
          // @xyflow phải check trước các nhánh react: path package của nó (@xyflow/react/) tự chứa substring "/react/".
          manualChunks(id) {
            if (id.includes("sea-live.json")) return "sea-data";
            if (!id.includes("node_modules")) return undefined;
            // react-colorful load động (picker easter egg) — để Rollup tự tách
            // chunk riêng, không gom vào vendor tải ngay lúc mở trang.
            if (id.includes("react-colorful")) return undefined;
            if (id.includes("@xyflow")) return "xyflow";
            if (id.includes("/react-dom/") || id.includes("/react/"))
              return "react";
            if (id.includes("/scheduler/")) return "react";
            return "vendor";
          },
        },
      },
    },
  };
});
