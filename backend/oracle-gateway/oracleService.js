const { getVgmData } = require("../mock-apis/vgm-mock");
const { getAisStatus } = require("../mock-apis/ais-mock");
const { getCeisaClearance } = require("../mock-apis/ceisa-mock");
const { validateCid } = require("../mock-apis/ipfs-mock");

function getMockStatus(contractId, options = {}) {
  const vgm = getVgmData(contractId, options.vgm);
  const ais = getAisStatus(contractId, options.ais);
  const ceisa = getCeisaClearance(contractId, options.ceisa);
  const ipfs = validateCid(options.eblCid || "bafybeisternelectronicbillofla");

  const verification = {
    vgmMatch: vgm.vgm_match === true && vgm.gate_in_status === "confirmed",
    aisDeparted: ais.departure_status === "departed",
    ceisaApproved: ceisa.customs_status === "approved",
    eblCidValid: ipfs.valid === true
  };

  return {
    contractId,
    sources: { vgm, ais, ceisa, ipfs },
    verification,
    allVerified: Object.values(verification).every(Boolean)
  };
}

module.exports = { getMockStatus };
