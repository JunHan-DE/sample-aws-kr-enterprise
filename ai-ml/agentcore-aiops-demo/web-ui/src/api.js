const API_BASE = process.env.REACT_APP_API_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || res.statusText || `HTTP ${res.status}`); }
  return res.json();
}

export const api = {
  // Workloads
  listWorkloads: () => request("/workloads"),
  getWorkload: (id) => request(`/workloads/${id}`),
  createWorkload: (data) => request("/workloads", { method: "POST", body: JSON.stringify(data) }),
  updateWorkload: (id, data) => request(`/workloads/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteWorkload: (id) => request(`/workloads/${id}`, { method: "DELETE" }),
  getUploadUrl: (id, filename, contentType) =>
    request(`/workloads/${id}/upload-url`, { method: "POST", body: JSON.stringify({ filename, content_type: contentType }) }),
  listDocuments: (id) => request(`/workloads/${id}/documents`),
  deleteDocument: (id, key) => request(`/workloads/${id}/documents`, { method: "DELETE", body: JSON.stringify({ key }) }),
  syncKb: (id) => request(`/workloads/${id}/sync`, { method: "POST" }),

  // Reports
  listReports: () => request("/reports"),
  getReport: (id) => request(`/reports/${id}`),
  deleteReport: (id) => request(`/reports/${id}`, { method: "DELETE" }),
  approveAction: (id, actionId) => request(`/reports/${id}/approve`, { method: "POST", body: JSON.stringify({ action_id: actionId }) }),

  // Status & Chat
  getStatus: () => request("/status"),
  chat: async (message, sessionId) => {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || e.message || `HTTP ${res.status}`); }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/event-stream")) {
      const text = await res.text();
      let response = "", sid = sessionId;
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("event: response") && lines[i+1]?.startsWith("data: ")) response = lines[i+1].slice(6);
        if (lines[i].startsWith("event: error") && lines[i+1]?.startsWith("data: ")) response = `⚠️ ${lines[i+1].slice(6)}`;
        if (lines[i].startsWith("event: done") && lines[i+1]?.startsWith("data: ")) { try { sid = JSON.parse(lines[i+1].slice(6)).session_id || sid; } catch {} }
      }
      return { response, session_id: sid };
    }
    return res.json();
  },
};
