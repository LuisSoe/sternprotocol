import { useEffect, useMemo, useState } from "react";
import { Activity, Banknote, CheckCircle2, Clock4, RefreshCcw } from "lucide-react";
import EscrowCard from "../components/EscrowCard.jsx";
import StatCard from "../components/StatCard.jsx";
import { getBrowserContract } from "../lib/contract.js";

const baseEscrows = [
  {
    id: "Escrow #0",
    commodity: "Indonesian coffee",
    container: "TGHU-2026-001",
    cid: "bafybeistern...",
    value: "10 ETH",
    status: "Oracle verified",
    statusTone: "success"
  },
  {
    id: "Escrow #1",
    commodity: "Textile shipment",
    container: "MSKU-2026-014",
    cid: "bafybeistern...",
    value: "7.5 ETH",
    status: "Pending VGM",
    statusTone: "pending"
  }
];

const stateLabels = ["Pending", "Verified", "Completed", "Refunded", "Disputed"];
const stateTones = ["pending", "success", "success", "warning", "warning"];

export default function Home({ createdEscrow }) {
  const [chainEscrows, setChainEscrows] = useState([]);
  const [loadStatus, setLoadStatus] = useState("");

  async function loadChainEscrows() {
    if (!window.ethereum || !import.meta.env.VITE_CONTRACT_ADDRESS) {
      setLoadStatus("Mock dashboard: wallet or contract env not detected.");
      return;
    }

    try {
      setLoadStatus("Loading local contract escrows...");
      const contract = await getBrowserContract({ requireSigner: false });
      const next = Number(await contract.nextEscrowId());
      const ids = Array.from({ length: next }, (_item, index) => index);
      const rows = await Promise.all(
        ids.map(async (id) => {
          const escrow = await contract.getEscrow(id);
          const state = Number(escrow.state);

          return {
            id: `Escrow #${id}`,
            commodity: escrow.commodity || "Export shipment",
            container: escrow.containerRef,
            cid: `${escrow.eBLCID.slice(0, 12)}...`,
            value: `${Number(escrow.contractValue) / 1e18} ETH`,
            status: stateLabels[state] || "Unknown",
            statusTone: stateTones[state] || "muted"
          };
        })
      );

      setChainEscrows(rows);
      setLoadStatus(`Loaded ${rows.length} on-chain escrow(s).`);
    } catch (error) {
      setLoadStatus(error.message);
    }
  }

  useEffect(() => {
    loadChainEscrows();
  }, []);

  const fallbackEscrows = useMemo(() => createdEscrow
    ? [
        {
          id: `Escrow #${createdEscrow.id}`,
          commodity: createdEscrow.commodity,
          container: createdEscrow.containerRef,
          cid: createdEscrow.cid,
          value: `${createdEscrow.value} ETH`,
          status: "Created locally",
          statusTone: "pending"
        },
        ...baseEscrows
      ]
    : baseEscrows, [createdEscrow]);

  const escrows = useMemo(
    () => (chainEscrows.length > 0 ? chainEscrows : fallbackEscrows),
    [chainEscrows, fallbackEscrows]
  );

  const activeEscrows = escrows.filter((escrow) => escrow.status !== "Completed" && escrow.status !== "Refunded");

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Active escrow balance" value={`${activeEscrows.length} escrow(s)`} helper="Loaded from local contract when wallet is available" icon={Banknote} />
        <StatCard label="Active contracts" value={String(activeEscrows.length)} helper="Pending, verified, or disputed" icon={Activity} />
        <StatCard label="Total settled value" value={String(escrows.filter((escrow) => escrow.status === "Completed").length)} helper="Completed local escrow count" icon={CheckCircle2} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-md border border-stern-line bg-stern-panel p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-normal text-slate-50">Recent escrow activity</h1>
              <p className="text-sm text-slate-400">Shipment-linked settlement state</p>
            </div>
            <button
              type="button"
              onClick={loadChainEscrows}
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-md border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 transition-colors duration-200 hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-100"
              aria-label="Refresh on-chain escrows"
              title="Refresh on-chain escrows"
            >
              <RefreshCcw size={17} aria-hidden="true" />
            </button>
          </div>
          {loadStatus ? <p className="mb-3 text-xs text-slate-500">{loadStatus}</p> : null}
          <div className="space-y-3">
            {escrows.map((escrow) => (
              <EscrowCard key={`${escrow.id}-${escrow.container}`} escrow={escrow} />
            ))}
          </div>
        </div>

        <div className="rounded-md border border-stern-line bg-stern-panel p-4">
          <h2 className="text-lg font-semibold tracking-normal text-slate-50">Verification rails</h2>
          <div className="mt-4 grid gap-3">
            {["VGM port IoT", "AIS departure", "CEISA approval", "e-BL IPFS CID"].map((label, index) => (
              <div key={label} className="flex items-center justify-between rounded-md border border-stern-line bg-slate-950/40 px-3 py-3">
                <span className="text-sm text-slate-300">{label}</span>
                <span className={`text-xs font-medium ${index === 1 ? "text-cyan-200" : "text-emerald-200"}`}>
                  {index === 1 ? "Departed" : "Healthy"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
