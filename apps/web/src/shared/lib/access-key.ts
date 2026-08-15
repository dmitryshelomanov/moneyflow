export function getAccessKey(): string {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "k" && parts[1]) return parts[1];
  return import.meta.env.VITE_ACCESS_KEY || "dev-access-key-change-me";
}

export function apiBase(): string {
  return `/k/${getAccessKey()}/api`;
}
