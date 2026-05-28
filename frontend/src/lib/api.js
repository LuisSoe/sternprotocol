const API_BASE = import.meta.env.VITE_ORACLE_API || "http://localhost:4000";

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Oracle gateway request failed");
  }

  return payload;
}

export function getMockStatus(contractId) {
  return request(`/mock-status/${contractId}`);
}

export function submitOracle(contractId, body) {
  return request(`/submit-oracle/${contractId}`, {
    method: "POST",
    body: JSON.stringify(body || {})
  });
}

export function openDispute(contractId) {
  return request(`/open-dispute/${contractId}`, { method: "POST" });
}

export function resolveDispute(contractId, releaseToExporter) {
  return request(`/resolve-dispute/${contractId}`, {
    method: "POST",
    body: JSON.stringify({ releaseToExporter })
  });
}
