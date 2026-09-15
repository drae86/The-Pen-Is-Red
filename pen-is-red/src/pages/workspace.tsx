import { useState } from "react";
import { PanelLeft } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { AnalysisForm } from "@/components/analysis-form";
import { AnalysisView } from "@/components/analysis-view";

export default function Workspace() {
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  const handleSelect = (id: number | null) => {
    setPendingPrint(false);
    setSelectedAnalysisId(id);
  };

  const handlePrintRequest = (id: number) => {
    setSelectedAnalysisId(id);
    setPendingPrint(true);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sliding sidebar wrapper — collapses to w-0 when closed */}
      <div
        className={`no-print flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${
          sidebarOpen ? "w-80" : "w-0"
        }`}
      >
        <div className="w-80 h-full">
          <Sidebar
            selectedId={selectedAnalysisId}
            onSelect={handleSelect}
            onPrint={handlePrintRequest}
            onCollapse={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto relative min-w-0">
        {/* Re-open button — floats at left edge when sidebar is hidden */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
            className="no-print fixed top-4 left-2 z-50 flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card shadow-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        {selectedAnalysisId ? (
          <AnalysisView
            id={selectedAnalysisId}
            onBack={() => handleSelect(null)}
            pendingPrint={pendingPrint}
            onPrintDone={() => setPendingPrint(false)}
            onAnalysisCreated={(id) => handleSelect(id)}
          />
        ) : (
          <AnalysisForm onAnalysisCreated={(id) => setSelectedAnalysisId(id)} />
        )}
      </main>
    </div>
  );
}
