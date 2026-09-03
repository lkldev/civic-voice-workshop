const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Something went wrong.");
  return body;
}

export function login(credentials) {
  return api("/api/login", { method: "POST", body: JSON.stringify(credentials) });
}
export function submitFeedback(feedback) {
  return api("/api/feedback", { method: "POST", body: JSON.stringify(feedback) });
}
export function getFeedback(session) {
  return api("/api/feedback", { headers: { Authorization: `Bearer ${session.token}` } });
}
export function updateFeedbackStatus(session, id, status) {
  return api(`/api/feedback/${id}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ status }),
  });
}
export function getFeedbackDetail(session, id) {
  return api(`/api/feedback/${id}`, { headers: { Authorization: `Bearer ${session.token}` } });
}
