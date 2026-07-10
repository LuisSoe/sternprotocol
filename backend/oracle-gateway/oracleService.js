const { getVgmData } = require("../mock-apis/vgm-mock");
const { getAisStatus } = require("../mock-apis/ais-mock");
const { getCeisaClearance } = require("../mock-apis/ceisa-mock");
const { validateCid } = require("../mock-apis/ipfs-mock");
const { getInspectionReport } = require("../mock-apis/inspection-mock");

function getMockStatus(contractId, options = {}) {
  const vgm = getVgmData(contractId, options.vgm);
  const ais = getAisStatus(contractId, options.ais);
  const ceisa = getCeisaClearance(contractId, options.ceisa);
  const ipfs = validateCid(options.eblCid || "bafybeisternelectronicbillofla");
  const inspection = getInspectionReport(contractId, options.inspection);

  const verification = {
    vgmMatch: vgm.vgm_match === true && vgm.gate_in_status === "confirmed",
    aisDeparted: ais.departure_status === "departed",
    ceisaApproved: ceisa.customs_status === "approved",
    eblCidValid: ipfs.valid === true,
    inspectionPassed: inspection.inspection_status === "passed"
  };

  return {
    contractId,
    sources: { vgm, ais, ceisa, ipfs, inspection },
    verification,
    allVerified: Object.values(verification).every(Boolean)
  };
}

module.exports = { getMockStatus };
