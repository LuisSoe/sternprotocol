import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Inbox, RefreshCcw } from "lucide-react";
import StatusPill from "../components/StatusPill.jsx";
import { getBrowserContract } from "../lib/contract.js";
import { CURRENCY_LABEL } from "../lib/currency.js";

const STATE_LABELS = ["Pending", "Verified", "Completed", "Refunded", "Disputed"];

export default function Overview({ escrows, isOnChainReady, onOpen, onCreate, onChainSync }) {
  const [chainStatus, setChainStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadChainEscrows() {
    if (!isOnChainReady) return;
    setLoading(true);
    setChainStatus("Reading escrows from the local contract…");

    try {
      const contract = await getBrowserContract({ requireSigner: false });
      const next = Number(await contract.nextEscrowId());
      const ids = Array.from({ length: next }, (_item, index) => index);
      const rows = await Promise.all(
        ids.map(async (id) => {
          const escrow = await contract.getEscrow(id);
          return {
            id: String(id),
            source: "chain",
            commodity: escrow.commodity || "Export shipment",
            containerRef: escrow.containerRef,
            cid: escrow.eBLCID,
            value: String(Number(escrow.contractValue) / 1e18),
            deadline: new Date(Number(escrow.deadline) * 1000).toISOString(),
            state: STATE_LABELS[Number(escrow.state)] || "Pending",
            exporter: escrow.exporterAddress,
            arbiter: escrow.arbiterAddress
          };
        })
      );
      onChainSync(rows);
      setChainStatus(rows.length === 0 ? "Contract deployed — no escrows created yet." : "");
    } catch (error) {
      setChainStatus(error.shortMessage || error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChainEscrows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnChainReady]);

  const stats = useMemo(() => {
    const active = escrows.filter((e) => ["Pending", "Verified", "Disputed"].includes(e.state));
    const locked = active.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
    const settled = escrows.filter((e) => e.state === "Completed");
    const settledValue = settled.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
    const disputed = escrows.filter((e) => e.state === "Disputed").length;
    return { activeCount: active.length, locked, settledCount: settled.length, settledValue, disputed };
  }, [escrows]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-paper">Escrows</h1>
          <p className="mt-0.5 text-sm text-paper-dim">
            {isOnChainReady
              ? "On-chain registry · local Hardhat network"
              : "Local mock session — connect a wallet and set VITE_CONTRACT_ADDRESS for on-chain mode"}
          </p>
        </div>
        <div className="flex gap-2">
          {isOnChainReady ? (
            <button
              type="button"
              onClick={loadChainEscrows}
              disabled={loading}
              className="flex cursor-pointer items-center gap-1.5 rounded border border-ink-700 px-3 py-2 text-xs font-medium text-paper-dim transition-colors duration-150 hover:border-ink-600 hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCcw size={13} aria-hidden="true" />
              Sync chain
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCreate}
            className="flex cursor-pointer items-center gap-1.5 rounded bg-brass-400 px-3.5 py-2 text-xs font-semibold text-ink-950 transition-colors duration-150 hover:bg-brass-300"
          >
            New escrow
            <ArrowUpRight size={13} aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded border border-ink-700 bg-ink-700 lg:grid-cols-4">
        <Stat label="Active escrows" value={String(stats.activeCount)} />
        <Stat label="Value locked" value={`${stats.locked.toLocaleString()} ${CURRENCY_LABEL}`} mono />
        <Stat
          label="Settled"
          value={`${stats.settledCount} · ${stats.settledValue.toLocaleString()} ${CURRENCY_LABEL}`}
          mono
        />
        <Stat label="Open disputes" value={String(stats.disputed)} warn={stats.disputed > 0} />
      </section>

      {chainStatus ? <p className="mb-3 text-xs text-paper-faint">{chainStatus}</p> : null}

      {escrows.length === 0 ? (
        <div className="grid place-items-center rounded border border-dashed border-ink-600 px-6 py-16 text-center">
          <Inbox size={22} className="mb-3 text-paper-faint" aria-hidden="true" />
          <p className="text-sm font-medium text-paper">No escrows yet</p>
          <p className="mt-1 max-w-sm text-xs text-paper-dim">
            Lock the first shipment: the importer deposits funds, the contract releases them only when
            all five trade checks are attested.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-4 cursor-pointer rounded bg-brass-400 px-4 py-2 text-xs font-semibold text-ink-950 transition-colors duration-150 hover:bg-brass-300"
          >
            Create escrow
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-ink-700">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink-700 bg-ink-900">
                {["ID", "Commodity", "Container", "Value", "Deadline", "State"].map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-3.5 py-2.5 text-2xs font-medium uppercase tracking-widest text-paper-faint"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {escrows.map((escrow) => (
                <tr
                  key={`${escrow.source}-${escrow.id}`}
                  onClick={() => onOpen(escrow.id)}
                  className="cursor-pointer border-b border-ink-800 transition-colors duration-150 last:border-b-0 hover:bg-ink-850"
                >
                  <td className="px-3.5 py-3 font-mono text-xs text-brass-300">#{escrow.id}</td>
                  <td className="px-3.5 py-3 text-sm text-paper">{escrow.commodity}</td>
                  <td className="px-3.5 py-3 font-mono text-xs text-paper-dim">{escrow.containerRef}</td>
                  <td className="px-3.5 py-3 font-mono text-xs text-paper">
                    {Number(escrow.value).toLocaleString()} {CURRENCY_LABEL}
                  </td>
                  <td className="px-3.5 py-3 text-xs text-paper-dim">
                    {escrow.deadline ? new Date(escrow.deadline).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3.5 py-3">
                    <StatusPill state={escrow.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono, warn }) {
  return (
    <div className="bg-ink-900 px-4 py-3.5">
      <p className="text-2xs font-medium uppercase tracking-widest text-paper-faint">{label}</p>
      <p
        className={`mt-1 text-base font-semibold ${mono ? "font-mono text-sm" : ""} ${
          warn ? "text-state-warn" : "text-paper"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
