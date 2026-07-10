function getInspectionReport(contractId, overrides = {}) {
  const parsedId = Number(contractId || 0);
  const numericId = Number.isFinite(parsedId) ? parsedId : 0;

  return {
    certificate_number: overrides.certificate_number || `PSI-2026-${String(numericId).padStart(6, "0")}`,
    surveyor: overrides.surveyor || "Sucofindo",
    inspection_status: overrides.inspection_status || "passed",
    inspected_at: overrides.inspected_at || new Date(Date.UTC(2026, 4, 27, 14, numericId)).toISOString(),
    location: "Tanjung Priok"
  };
}

module.exports = { getInspectionReport };
