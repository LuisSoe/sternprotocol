import { useMemo, useState } from "react";
import { ethers } from "ethers";
import { FileUp, Send } from "lucide-react";
import { mockUpload } from "../lib/ipfs.js";
import { getBrowserContract } from "../lib/contract.js";

const initialForm = {
  importer: "",
  exporter: "",
  arbiter: "",
  value: "1",
  commodity: "Indonesian coffee",
  containerRef: "TGHU-2026-001",
  deadline: "",
  fileName: "electronic-bill-of-lading.pdf"
};

export default function CreateEscrow({ onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [cidResult, setCidResult] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const hasContractAddress = Boolean(import.meta.env.VITE_CONTRACT_ADDRESS);
  const hasInjectedWallet = typeof window !== "undefined" && Boolean(window.ethereum);
  const isOnChainReady = hasContractAddress && hasInjectedWallet;

  const canSubmit = useMemo(() => {
    return form.exporter && form.arbiter && form.value && form.commodity && form.containerRef && cidResult?.cid;
  }, [form, cidResult]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function handleMockUpload() {
    const result = mockUpload(form.fileName);
    setCidResult(result);
    setStatus(`Mock e-BL uploaded: ${result.cid}`);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const deadlineSeconds = form.deadline
        ? Math.floor(new Date(form.deadline).getTime() / 1000)
        : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

      let txHash = "mock-transaction";
      let id = Date.now().toString().slice(-5);

      if (isOnChainReady) {
        const contract = await getBrowserContract();
        const nextId = await contract.nextEscrowId?.();
        const tx = await contract.createEscrow(
          form.exporter,
          form.arbiter,
          cidResult.cid,
          deadlineSeconds,
          form.commodity,
          form.containerRef,
          { value: ethers.parseEther(form.value) }
        );
        const receipt = await tx.wait();
        txHash = receipt.hash;
        const parsedEvent = receipt.logs
          .map((log) => {
            try {
              return contract.interface.parseLog(log);
            } catch (_error) {
              return null;
            }
          })
          .find((event) => event?.name === "EscrowCreated");
        id = parsedEvent?.args?.escrowId?.toString?.() || nextId?.toString?.() || id;
      } else {
        setStatus(
          hasContractAddress
            ? "Mock mode: browser did not expose window.ethereum. Open this page in Chrome with MetaMask enabled."
            : "Mock mode: missing VITE_CONTRACT_ADDRESS in frontend/.env."
        );
      }

      onCreated?.({
        id,
        txHash,
        commodity: form.commodity,
        containerRef: form.containerRef,
        cid: cidResult.cid,
        value: form.value
      });
      setStatus(`Escrow ID ${id} created. Transaction hash: ${txHash}`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleCreate} className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
      <section className="rounded-md border border-stern-line bg-stern-panel p-4">
        <h1 className="text-lg font-semibold tracking-normal">Create escrow</h1>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ["importer", "Importer wallet"],
            ["exporter", "Exporter wallet"],
            ["arbiter", "Arbiter wallet"],
            ["value", "Contract value (ETH)"],
            ["commodity", "Commodity"],
            ["containerRef", "Container reference"]
          ].map(([name, label]) => (
            <label key={name} className="block">
              <span className="text-sm text-slate-300">{label}</span>
              <input
                name={name}
                value={form[name]}
                onChange={updateField}
                className="mt-2 w-full rounded-md border border-stern-line bg-slate-950 px-3 py-3 text-sm text-slate-50 outline-none transition-colors duration-200 placeholder:text-slate-600 focus:border-teal-300"
                placeholder={label}
              />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className="text-sm text-slate-300">Deadline</span>
            <input
              type="datetime-local"
              name="deadline"
              value={form.deadline}
              onChange={updateField}
              className="mt-2 w-full rounded-md border border-stern-line bg-slate-950 px-3 py-3 text-sm text-slate-50 outline-none transition-colors duration-200 focus:border-teal-300"
            />
          </label>
        </div>
      </section>

      <section className="rounded-md border border-stern-line bg-stern-panel p-4">
        <h2 className="text-lg font-semibold tracking-normal">Mock e-BL upload</h2>
        <div className="mt-4 rounded-md border border-stern-line bg-slate-950/50 p-3 text-sm">
          <p className="font-medium text-slate-100">
            Mode: {isOnChainReady ? "On-chain transaction" : "Mock fallback"}
          </p>
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            <p>Contract env: {hasContractAddress ? import.meta.env.VITE_CONTRACT_ADDRESS : "missing"}</p>
            <p>MetaMask injection: {hasInjectedWallet ? "detected" : "not detected"}</p>
          </div>
        </div>
        <label className="mt-4 block">
          <span className="text-sm text-slate-300">File name</span>
          <input
            name="fileName"
            value={form.fileName}
            onChange={updateField}
            className="mt-2 w-full rounded-md border border-stern-line bg-slate-950 px-3 py-3 text-sm text-slate-50 outline-none transition-colors duration-200 focus:border-teal-300"
          />
        </label>
        <button
          type="button"
          onClick={handleMockUpload}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100"
        >
          <FileUp size={17} aria-hidden="true" />
          Mock upload
        </button>
        {cidResult ? (
          <div className="mt-4 rounded-md border border-teal-300/30 bg-teal-300/10 p-3 text-sm text-teal-100">
            {cidResult.cid}
          </div>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmit || busy}
          className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-teal-300 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <Send size={17} aria-hidden="true" />
          {busy ? "Submitting" : "Create escrow"}
        </button>
        {status ? <p className="mt-4 break-words text-sm text-slate-300">{status}</p> : null}
      </section>
    </form>
  );
}
