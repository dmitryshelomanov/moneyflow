import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

function trailingSlashBaseCompat(basePath: string) {
  const baseNoSlash =
    basePath !== "/" && basePath.endsWith("/")
      ? basePath.slice(0, -1)
      : basePath;

  const maybeRedirect = (
    rawUrl: string | undefined,
    redirect: (location: string) => void,
  ) => {
    if (!rawUrl) return;
    const url = new URL(rawUrl, "http://localhost");
    if (url.pathname !== baseNoSlash) return;
    redirect(`${basePath}${url.search}${url.hash}`);
  };

  return {
    name: "trailing-slash-base-compat",
    configureServer(server: {
      middlewares: {
        use: (
          handler: (
            req: { url?: string },
            res: {
              statusCode: number;
              setHeader: (name: string, value: string) => void;
              end: () => void;
            },
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
      server.middlewares.use((req, res, next) => {
        let redirected = false;
        maybeRedirect(req.url, (location) => {
          redirected = true;
          res.statusCode = 302;
          res.setHeader("Location", location);
          res.end();
        });
        if (!redirected) next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "");
  const accessKey = env.ACCESS_KEY || "dev-access-key";
  const apiPort = env.PORT || "3000";
  const basePath = `/k/${accessKey}/`;

  return {
    plugins: [react(), tailwindcss(), trailingSlashBaseCompat(basePath)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: basePath,
    server: {
      port: 5173,
      proxy: {
        [`/k/${accessKey}/api`]: {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
