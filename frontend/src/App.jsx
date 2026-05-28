import { useMemo, useState } from "react";
import { BarChart3, FilePlus2, Gauge, ShieldCheck } from "lucide-react";
import Home from "./pages/Home.jsx";
import CreateEscrow from "./pages/CreateEscrow.jsx";
import Settlement from "./pages/Settlement.jsx";

const tabs = [
  { id: "home", label: "Dashboard", icon: BarChart3 },
  { id: "create", label: "Create", icon: FilePlus2 },
  { id: "settlement", label: "Settlement", icon: Gauge }
];

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [createdEscrow, setCreatedEscrow] = useState(null);

  const activePage = useMemo(() => {
    if (activeTab === "create") {
      return <CreateEscrow onCreated={setCreatedEscrow} />;
    }

    if (activeTab === "settlement") {
      return <Settlement createdEscrow={createdEscrow} />;
    }

    return <Home createdEscrow={createdEscrow} />;
  }, [activeTab, createdEscrow]);

  return (
    <div className="min-h-screen bg-stern-bg text-slate-50">
      <header className="sticky top-0 z-20 border-b border-stern-line bg-stern-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-teal-300/30 bg-teal-300/10 text-teal-200">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight tracking-normal">STERN Protocol</p>
              <p className="text-xs text-slate-400">Smart export escrow MVP</p>
            </div>
          </div>
          <div className="hidden rounded-md border border-stern-line bg-stern-panel px-3 py-2 text-xs text-slate-300 sm:block">
            Local Hardhat Network
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:pb-8">
        {activePage}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-stern-line bg-stern-bg/95 px-3 py-3 backdrop-blur sm:hidden">
        <div className="grid grid-cols-3 gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-md border text-xs transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-300 ${
                  selected
                    ? "border-teal-300/40 bg-teal-300/15 text-teal-100"
                    : "border-transparent bg-stern-panel text-slate-400 hover:text-slate-100"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="mt-1">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <aside className="fixed bottom-6 left-1/2 z-30 hidden -translate-x-1/2 rounded-md border border-stern-line bg-stern-panel/95 p-1 shadow-glow backdrop-blur sm:block">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-300 ${
                  selected
                    ? "bg-teal-300 text-slate-950"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
