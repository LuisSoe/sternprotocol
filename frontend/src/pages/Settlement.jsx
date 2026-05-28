import { useMemo, useState } from "react";
import { AlertTriangle, CheckCheck, RotateCcw, ShieldAlert } from "lucide-react";
import OracleFeed from "../components/OracleFeed.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { getMockStatus, openDispute, submitOracle } from "../lib/api.js";
import { getBrowserContract } from "../lib/contract.js";

export default function Settlement({ createdEscrow }) {
  const [contractId, setContractId] = useState(createdEscrow?.id || "0");
  const [oracleStatus, setOracleStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const value = Number(createdEscrow?.value || 10);
  const platformFee = value * 0.005;
  const gasPlaceholder = 0.002;

  const feed = useMemo(() => {
    const verification = oracleStatus?.verification || {
      vgmMatch: true,
      aisDeparted: true,
      ceisaApproved: true,
      eblCidValid: true
    };

    return [
      { label: "VGM checked", detail: "Port IoT confirms verified gross mass", ok: verification.vgmMatch },
      { label: "AIS departed", detail: "Vessel departure status is departed", ok: verification.aisDeparted },
      { label: "CEISA approved", detail: "Customs clearance mock is approved", ok: verification.ceisaApproved },
      { label: "e-BL CID valid", detail: createdEscrow?.cid || "bafybeistern...", ok: verification.eblCidValid }
    ];
  }, [oracleStatus, createdEscrow]);

  async function runAction(action) {
    setBusy(true);
    setMessage("");

    try {
      const result = await action();
      setMessage(result?.result?.transactionHash || result?.transactionHash || "Action completed");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1fr]">
      <section className="rounded-md border border-stern-line bg-stern-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-normal">Settlement console</h1>
            <p className="text-sm text-slate-400">Escrow #{contractId}</p>
          </div>
          <StatusBadge tone={oracleStatus?.allVerified ? "success" : "pending"}>
            {oracleStatus?.allVerified ? "Verified" : "Awaiting submit"}
          </StatusBadge>
        </div>

        <label className="mt-5 block">
          <span className="text-sm text-slate-300">Escrow ID</span>
          <input
            value={contractId}
            onChange={(event) => setContractId(event.target.value)}
            className="mt-2 w-full rounded-md border border-stern-line bg-slate-950 px-3 py-3 text-sm text-slate-50 outline-none transition-colors duration-200 focus:border-teal-300"
          />
        </label>

        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => runAction(async () => {
              const status = await getMockStatus(contractId);
              setOracleStatus(status);
              return { transactionHash: "Mock oracle status refreshed" };
            })}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-cyan-300/40 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition-colors duration-200 hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-100"
          >
            <CheckCheck size={17} aria-hidden="true" />
            Refresh mock feed
          </button>
          <button
            type="button"
            onClick={() => runAction(() => submitOracle(contractId, { eblCid: createdEscrow?.cid }))}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-100"
          >
            <CheckCheck size={17} aria-hidden="true" />
            Submit oracle verification
          </button>
          <button
            type="button"
            onClick={() => runAction(async () => {
              const contract = await getBrowserContract();
              const tx = await contract.releaseEscrow(contractId);
              const receipt = await tx.wait();
              return { transactionHash: receipt.hash };
            })}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition-colors duration-200 hover:bg-emerald-300/20 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          >
            <CheckCheck size={17} aria-hidden="true" />
            Release settlement
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => runAction(() => openDispute(contractId))}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100 transition-colors duration-200 hover:bg-amber-300/20 focus:outline-none focus:ring-2 focus:ring-amber-100"
            >
              <ShieldAlert size={17} aria-hidden="true" />
              Open dispute
            </button>
            <button
              type="button"
              onClick={() => runAction(async () => {
                const contract = await getBrowserContract();
                const tx = await contract.claimRefund(contractId);
                const receipt = await tx.wait();
                return { transactionHash: receipt.hash };
              })}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-500 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors duration-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <RotateCcw size={17} aria-hidden="true" />
              Request refund
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-4 flex gap-3 rounded-md border border-stern-line bg-slate-950/60 p-3 text-sm text-slate-300">
            <AlertTriangle size={18} className="shrink-0 text-cyan-200" aria-hidden="true" />
            <p className="break-words">{busy ? "Working" : message}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-md border border-stern-line bg-stern-panel p-4">
        <h2 className="text-lg font-semibold tracking-normal">Oracle feed</h2>
        <div className="mt-4">
          <OracleFeed items={feed} />
        </div>
        <div className="mt-5 rounded-md border border-stern-line bg-slate-950/40 p-4">
          <h3 className="text-sm font-semibold text-slate-100">Settlement breakdown</h3>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Gross value" value={`${value.toFixed(3)} ETH`} />
            <Row label="Platform fee" value={`${platformFee.toFixed(3)} ETH`} />
            <Row label="Gas fee placeholder" value={`${gasPlaceholder.toFixed(3)} ETH`} />
            <Row label="Net to exporter" value={`${(value - platformFee - gasPlaceholder).toFixed(3)} ETH`} strong />
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className={strong ? "font-semibold text-teal-100" : "text-slate-200"}>{value}</span>
    </div>
  );
}
