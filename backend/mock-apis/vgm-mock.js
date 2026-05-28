function getVgmData(contractId, overrides = {}) {
  const parsedId = Number(contractId || 0);
  const numericId = Number.isFinite(parsedId) ? parsedId : 0;
  const expected = 24000 + numericId;
  const actual = overrides.vgm_kg || expected;

  return {
    containerRef: overrides.containerRef || `STERN-${String(numericId).padStart(4, "0")}`,
    vgm_kg: actual,
    expected_vgm_kg: expected,
    vgm_match: overrides.vgm_match ?? actual === expected,
    gate_in_status: overrides.gate_in_status || "confirmed",
    port: "Tanjung Priok"
  };
}

module.exports = { getVgmData };
