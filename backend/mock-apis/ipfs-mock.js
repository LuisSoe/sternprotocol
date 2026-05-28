const CID_PREFIX = "bafybeistern";

function mockUpload(fileName = "electronic-bill-of-lading.pdf") {
  const normalized = fileName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 22);

  return {
    fileName,
    cid: `${CID_PREFIX}${normalized || "ebldocument"}`,
    valid: true
  };
}

function validateCid(cid) {
  return {
    fileName: "electronic-bill-of-lading.pdf",
    cid,
    valid: typeof cid === "string" && cid.startsWith(CID_PREFIX)
  };
}

module.exports = { mockUpload, validateCid };
