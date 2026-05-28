function getAisStatus(contractId, overrides = {}) {
  const parsedId = Number(contractId || 0);
  const numericId = Number.isFinite(parsedId) ? parsedId : 0;

  return {
    vesselIMO: overrides.vesselIMO || `IMO${9300000 + numericId}`,
    departure_status: overrides.departure_status || "departed",
    timestamp: overrides.timestamp || new Date(Date.UTC(2026, 4, 28, 8, numericId)).toISOString()
  };
}

module.exports = { getAisStatus };
