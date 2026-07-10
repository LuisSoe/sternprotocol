// Demo identities mapped to the standard Hardhat accounts used by the deploy
// script and DEMO_FILL_EXAMPLE.md. In wallet mode the connected MetaMask
// account is authoritative; these define who the UI is "acting as".
export const ACTORS = [
  {
    id: "importer",
    label: "Importer",
    org: "Hamburg Coffee Buyer GmbH",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  },
  {
    id: "exporter",
    label: "Exporter",
    org: "UMKM Kopi Gayo, Aceh",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
  },
  {
    id: "arbiter",
    label: "Arbiter",
    org: "Surveyor / Inspection body",
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906"
  }
];

export function actorById(id) {
  return ACTORS.find((actor) => actor.id === id) || ACTORS[0];
}

export function shortAddress(address) {
  if (!address || address.length < 12) return address || "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
