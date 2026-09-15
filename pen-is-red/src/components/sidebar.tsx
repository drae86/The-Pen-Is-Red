import { useListAnalyses, useDeleteAnalysis, useGetAnalysisStats, getListAnalysesQueryKey, getGetAnalysisStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Droplet, Moon, Sun, Trash2, Printer, Plus, BarChart2, FileText, AlertTriangle, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { AnalysisSummary } from "@workspace/api-client-react";
import { Separator } from "@/components/ui/separator";
import { getLensTheme } from "@/lib/lens-theme";
import { useLensTheme } from "@/contexts/lens-theme-context";

interface SidebarProps {
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onPrint?: (id: number) => void;
  onCollapse?: () => void;
}

export function Sidebar({ selectedId, onSelect, onPrint, onCollapse }: SidebarProps) {
  const { theme, setTheme } = useTheme();
  const { setActiveLens } = useLensTheme();
  const queryClient = useQueryClient();

  const { data: analyses, isLoading: isLoadingAnalyses } = useListAnalyses();
  const { data: stats, isLoading: isLoadingStats } = useGetAnalysisStats();

  const deleteAnalysis = useDeleteAnalysis();

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    deleteAnalysis.mutate(
      { id },
      {
        onSuccess: () => {
          if (selectedId === id) onSelect(null);
          queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAnalysisStatsQueryKey() });
        },
      }
    );
  };

  const handleSelect = (analysis: AnalysisSummary) => {
    onSelect(analysis.id);
    setActiveLens(analysis.lens);
  };

  const handleNewAnalysis = () => {
    onSelect(null);
    setActiveLens("red_team");
  };

  return (
    <div className="w-80 h-full border-r bg-sidebar flex flex-col flex-shrink-0 text-sidebar-foreground">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2 font-serif font-bold text-lg text-sidebar-foreground">
          <Droplet className="h-5 w-5 text-primary fill-primary" />
          <span>The Pen Is Red</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            data-testid="button-toggle-theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {onCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={onCollapse}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="p-4">
        <Button
          onClick={handleNewAnalysis}
          className="w-full justify-start gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="button-new-analysis"
        >
          <Plus className="h-4 w-4" />
          New Analysis
        </Button>
      </div>

      {/* History */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1.5 pb-4">
          <h3 className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-3 px-1">
            Recent Analyses
          </h3>

          {isLoadingAnalyses ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg border border-sidebar-border/50 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-sidebar-accent" />
                <Skeleton className="h-3 w-1/2 bg-sidebar-accent" />
                <Skeleton className="h-3 w-1/4 bg-sidebar-accent" />
              </div>
            ))
          ) : analyses?.length === 0 ? (
            <div className="text-center p-4 text-sm text-sidebar-foreground/60 italic">
              No analyses found. Start by creating one.
            </div>
          ) : (
            analyses?.map((analysis: AnalysisSummary) => {
              const lensTheme = getLensTheme(analysis.lens);
              return (
                <div
                  key={analysis.id}
                  data-testid={`analysis-item-${analysis.id}`}
                  onClick={() => handleSelect(analysis)}
                  className={`
                    p-3 rounded-lg border cursor-pointer transition-all relative group
                    ${selectedId === analysis.id
                      ? "bg-sidebar-accent border-sidebar-border"
                      : "border-transparent hover:border-sidebar-border/50 hover:bg-sidebar-accent/50"
                    }
                  `}
                >
                  <div className="pr-14">
                    <h4 className="text-sm font-medium line-clamp-1 mb-1.5" title={analysis.title}>
                      {analysis.title}
                    </h4>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 px-1.5 font-mono ${lensTheme.badgeClass}`}
                      >
                        {lensTheme.shortLabel}
                      </Badge>
                      <span className="text-[10px] text-sidebar-foreground/60 font-mono">
                        {format(new Date(analysis.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-sidebar-foreground/70">
                      <span className="flex items-center gap-1 font-mono">
                        <BarChart2 className="h-3 w-3" /> {analysis.overallScore}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <FileText className="h-3 w-3" /> {analysis.wordCount}w
                      </span>
                      {analysis.findingsCounts && (
                        (analysis.findingsCounts.critical ?? 0) > 0 && (
                          <span className="flex items-center gap-1 font-mono text-red-500">
                            <AlertTriangle className="h-3 w-3" />
                            {analysis.findingsCounts.critical}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onPrint && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-sidebar-accent/80 text-sidebar-foreground/50"
                        onClick={(e) => { e.stopPropagation(); onPrint(analysis.id); }}
                        data-testid={`button-print-${analysis.id}`}
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive text-sidebar-foreground/50"
                      onClick={(e) => handleDelete(e, analysis.id)}
                      data-testid={`button-delete-${analysis.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Stats */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/30">
        {isLoadingStats ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full bg-sidebar-accent" />
            <Skeleton className="h-3 w-2/3 bg-sidebar-accent" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex flex-col">
              <span className="text-sidebar-foreground/50 uppercase tracking-wider text-[10px] mb-1">Total</span>
              <span className="font-mono font-medium">{stats.totalAnalyses}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sidebar-foreground/50 uppercase tracking-wider text-[10px] mb-1">Avg Score</span>
              <span className="font-mono font-medium">{Math.round(stats.avgScore || 0)}/100</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sidebar-foreground/50 uppercase tracking-wider text-[10px] mb-1">Findings</span>
              <span className="font-mono font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                {stats.totalFindings}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
