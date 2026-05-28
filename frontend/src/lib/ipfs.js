export function mockUpload(fileName) {
  const clean = (fileName || "electronic-bill-of-lading.pdf")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 22);

  return {
    fileName: fileName || "electronic-bill-of-lading.pdf",
    cid: `bafybeistern${clean || "ebldocument"}`,
    valid: true
  };
}
