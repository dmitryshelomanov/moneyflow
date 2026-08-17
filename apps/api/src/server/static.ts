import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Hono } from "hono";
import { env } from "../env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDistRoot = path.resolve(__dirname, "../../../web/dist");

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function stripGuardPrefix(urlPath: string): string {
  const prefix = `/k/${env.ACCESS_KEY}`;
  return urlPath.startsWith(prefix) ? urlPath.slice(prefix.length) : urlPath;
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

function resolveStaticPath(urlPath: string): string | null {
  let relativePath = stripGuardPrefix(urlPath);
  if (!relativePath || relativePath === "/") {
    relativePath = "/index.html";
  }

  const candidatePath = path.normalize(path.join(webDistRoot, relativePath));
  if (
    !isPathInside(webDistRoot, candidatePath) &&
    candidatePath !== webDistRoot
  ) {
    return null;
  }
  return candidatePath;
}

function tryReadStaticFile(
  candidatePath: string,
): { body: Buffer; type: string } | null {
  if (!fs.existsSync(candidatePath) || !fs.statSync(candidatePath).isFile()) {
    return null;
  }

  const ext = path.extname(candidatePath).toLowerCase();
  return {
    body: fs.readFileSync(candidatePath),
    type: contentTypes[ext] ?? "application/octet-stream",
  };
}

function escapeHtmlAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function injectRuntimeHtml(
  html: string,
  options: { accessKey: string; telegramBotId: string },
): string {
  const baseHref = `/k/${options.accessKey}/`;
  const config = JSON.stringify({
    telegramBotId: options.telegramBotId || undefined,
  });
  const inject = `<base href="${escapeHtmlAttr(baseHref)}"><script>window.__MF_CONFIG__=${config};</script>`;
  if (html.includes("<head>")) {
    return html.replace("<head>", `<head>${inject}`);
  }
  return `${inject}${html}`;
}

let cachedIndexHtml: string | null = null;

function getIndexHtml(): string {
  if (!cachedIndexHtml) {
    const raw = fs.readFileSync(path.join(webDistRoot, "index.html"), "utf8");
    cachedIndexHtml = injectRuntimeHtml(raw, {
      accessKey: env.ACCESS_KEY,
      telegramBotId: env.telegramBotId,
    });
  }
  return cachedIndexHtml;
}

export function registerProductionStaticRoutes(router: Hono): void {
  if (env.NODE_ENV !== "production" || !fs.existsSync(webDistRoot)) {
    return;
  }

  router.get("/*", (c) => {
    const urlPath = new URL(c.req.url).pathname;
    const candidatePath = resolveStaticPath(urlPath);
    if (!candidatePath) {
      return c.notFound();
    }

    const staticFile = tryReadStaticFile(candidatePath);
    if (staticFile) {
      if (staticFile.type.startsWith("text/html")) {
        return c.html(getIndexHtml());
      }
      return c.body(new Uint8Array(staticFile.body), 200, {
        "Content-Type": staticFile.type,
      });
    }

    return c.html(getIndexHtml());
  });
}
