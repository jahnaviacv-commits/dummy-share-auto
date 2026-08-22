/** Render backend — used when the UI is hosted on Surge or any other static host. */
export const REMOTE_BACKEND = "https://dummy-share-auto-1.onrender.com";

export function getBackendOrigin() {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "127.0.50") return "";
  if (host.endsWith("onrender.com")) return "";
  return REMOTE_BACKEND;
}

export function apiUrl(path) {
  return `${getBackendOrigin()}${path}`;
}

export function wsUrl() {
  const origin = getBackendOrigin();
  if (origin) {
    const url = new URL(origin);
    const protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${url.host}`;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.50" ||
    window.location.hostname === "127.0.0.1"
      ? "localhost:5000"
      : window.location.host;
  return `${protocol}//${host}`;
}
