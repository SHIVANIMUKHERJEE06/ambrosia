// api.js — all backend calls go through here
// This ensures VITE_API_BASE_URL is applied in production and auth
// tokens are always included. Never use raw fetch() for backend calls.

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "") + "/api";

function getToken() {
  try { return localStorage.getItem("ambrosia_token"); } catch { return null; }
}
export function setToken(token) {
  try { localStorage.setItem("ambrosia_token", token); } catch {}
}
export function clearToken() {
  try { localStorage.removeItem("ambrosia_token"); } catch {}
}
export function isLoggedIn() { return !!getToken(); }

async function request(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (!options.isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (isJson && body.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.code = isJson ? body.code : undefined;
    throw err;
  }
  return body;
}

export const api = {
  // GET helper exposed for Compare page and any future GET-with-params calls
  getJSON: (path) => request(path),

  analyze: (payload) =>
    request("/analyze", { method: "POST", body: JSON.stringify(payload) }),

  compareProducts: (products, skinType, environment) =>
    request("/compare", { method: "POST", body: JSON.stringify({ products, skinType, environment }) }),

  interactions: (ingredientTextA, ingredientTextB) =>
    request("/interactions", { method: "POST", body: JSON.stringify({ ingredientTextA, ingredientTextB }) }),

  datasetInfo: () => request("/dataset-info"),

  ocr: (file) => {
    const formData = new FormData();
    formData.append("photo", file);
    return request("/ocr", { method: "POST", body: formData, isFormData: true });
  },

  signup: (email, password) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) }),

  login: (email, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),

  getProfile: () => request("/profile"),
  saveProfile: (profile) =>
    request("/profile", { method: "PUT", body: JSON.stringify(profile) }),

  getHistory: (limit = 50) => request(`/history?limit=${limit}`),
  getScanById: (id) => request(`/history/${id}`),
};
