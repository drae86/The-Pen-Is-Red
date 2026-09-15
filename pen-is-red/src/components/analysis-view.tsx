import { useEffect, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAnalysis,
  useGetAnalysisSolutions,
  getGetAnalysisQueryKey,
  getGetAnalysisSolutionsQueryKey,
  getListAnalysesQueryKey,
  getGetAnalysisStatsQueryKey,
} from "@workspace/api-client-react";
import {
  ArrowLeft, FileText, AlertTriangle,
  Info, Shield, Terminal, Link as LinkIcon,
  AlertCircle, Sparkles, Download, MessageSquareQuote, Loader2,
  CornerDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Analysis, Finding, Citation } from "@workspace/api-client-react";
import { getLensTheme } from "@/lib/lens-theme";
import { useLensTheme } from "@/contexts/lens-theme-context";
import { useToast } from "@/hooks/use-toast";

interface AnalysisViewProps {
  id: number;
  onBack: () => void;
  pendingPrint?: boolean;
  onPrintDone?: () => void;
  onAnalysisCreated?: (id: number) => void;
}

const SEVERITY_CONFIG: Record<string, { color: string; icon: typeof Info; label: string }> = {
  critical: { color: "bg-red-500/10 text-red-500 border-red-500/30", icon: AlertTriangle, label: "Critical" },
  high: { color: "bg-orange-500/10 text-orange-500 border-orange-500/30", icon: AlertCircle, label: "High" },
  medium: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30", icon: AlertTriangle, label: "Medium" },
  low: { color: "bg-blue-500/10 text-blue-500 border-blue-500/30", icon: Info, label: "Low" },
  info: { color: "bg-slate-500/10 text-slate-500 border-slate-500/30", icon: Info, label: "Info" },
};

const CITATION_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  verified: { color: "text-green-500 border-green-500/30 bg-green-500/10", label: "Verified" },
  unverified: { color: "text-yellow-500 border-yellow-500/30 bg-yellow-500/10", label: "Unverified" },
  disputed: { color: "text-red-500 border-red-500/30 bg-red-500/10", label: "Disputed" },
  unavailable: { color: "text-slate-500 border-slate-500/30 bg-slate-500/10", label: "Unavailable" },
};

export function AnalysisView({ id, onBack, pendingPrint, onPrintDone, onAnalysisCreated }: AnalysisViewProps) {
  const { setActiveLens } = useLensTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: analysis, isLoading, error } = useGetAnalysis(id, {
    query: { enabled: !!id, queryKey: getGetAnalysisQueryKey(id) },
  });

  const [showSolutions, setShowSolutions] = useState(false);

  const { data: solutions, isLoading: isSolutionsLoading, refetch: fetchSolutions } = useGetAnalysisSolutions(id, {
    query: { enabled: false, queryKey: getGetAnalysisSolutionsQueryKey(id) },
  });

  // Rebuttal state
  const [showRebuttal, setShowRebuttal] = useState(false);
  const [rebuttalText, setRebuttalText] = useState("");
  const [isSubmittingRebuttal, setIsSubmittingRebuttal] = useState(false);

  const handleSubmitRebuttal = async () => {
    if (rebuttalText.trim().length < 10) return;
    setIsSubmittingRebuttal(true);
    try {
      const res = await fetch(`/api/analyses/${id}/rebuttal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rebuttalText: rebuttalText.trim(), lens: analysis?.lens }),
      });
      const json = await res.json() as { id?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Rebuttal failed");
      queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAnalysisStatsQueryKey() });
      setRebuttalText("");
      setShowRebuttal(false);
      if (json.id) onAnalysisCreated?.(json.id);
    } catch (err) {
      toast({
        title: "Rebuttal failed",
        description: err instanceof Error ? err.message : "Could not submit rebuttal.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingRebuttal(false);
    }
  };

  useEffect(() => {
    if (analysis?.lens) setActiveLens(analysis.lens);
  }, [analysis?.lens, setActiveLens]);

  useEffect(() => {
    const onAfter = () => onPrintDone?.();
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, [onPrintDone]);

  useEffect(() => {
    if (pendingPrint && analysis && !isLoading) {
      window.print();
    }
  }, [pendingPrint, analysis, isLoading]);

  const handleGetSolutions = () => {
    setShowSolutions(true);
    if (!solutions) fetchSolutions();
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-8 space-y-8">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-40 w-full" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <Button variant="ghost" onClick={onBack} className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to workspace
        </Button>
        <div className="text-center p-12 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <h2 className="text-xl font-bold mb-2">Error Loading Analysis</h2>
          <p>Failed to load the requested document analysis.</p>
        </div>
      </div>
    );
  }

  const lensTheme = getLensTheme(analysis.lens);
  const sortedFindings = [...(analysis.findings || [])].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (order[(a as Finding).severity] ?? 5) - (order[(b as Finding).severity] ?? 5);
  });

  const sections = analysis.sections as Array<{ title: string; content: string; score: number | null }> | null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto px-6 py-10 md:px-12 space-y-12 pb-24"
    >
      {/* Nav — hidden in print */}
      <div className="no-print flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground hover:text-foreground" data-testid="button-back">
          <ArrowLeft className="mr-2 h-4 w-4" /> New Analysis
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="gap-2 font-mono text-xs"
          data-testid="button-download-pdf"
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF
        </Button>
      </div>

      {/* Print-only branding header */}
      <div className="print-only print-header">
        <div className="print-brand">The Pen Is Red</div>
        <Badge
          variant="outline"
          className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${lensTheme.badgeClass}`}
        >
          {lensTheme.label}
        </Badge>
        <div className="print-meta">Exported {format(new Date(), "MMMM d, yyyy")}</div>
      </div>

      {/* Document header */}
      <header className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="outline"
            data-testid="lens-badge"
            className={`px-3 py-1 text-xs font-mono uppercase tracking-wider ${lensTheme.badgeClass}`}
          >
            <Shield className="mr-1.5 h-3.5 w-3.5" />
            {lensTheme.label}
          </Badge>
          <span className="text-sm font-mono text-muted-foreground">
            {format(new Date(analysis.createdAt), "MMMM d, yyyy · HH:mm")}
          </span>
          {analysis.confidenceLevel && (
            <Badge variant="secondary" className="px-3 py-1 text-xs font-mono">
              Confidence: {analysis.confidenceLevel}
            </Badge>
          )}
        </div>

        <h1 className="text-4xl md:text-5xl font-serif font-bold leading-tight">
          {analysis.title || "Untitled Document Analysis"}
        </h1>

        <div className="flex items-center gap-6 text-sm font-mono text-muted-foreground pt-2">
          <span className="flex items-center gap-2" data-testid="word-count-display">
            <FileText className="h-4 w-4" /> {analysis.wordCount} words
          </span>
          <span className="flex items-center gap-2" data-testid="char-count-display">
            <Terminal className="h-4 w-4" /> {analysis.charCount} characters
          </span>
        </div>
      </header>

      <Separator className="bg-border/50" />

      {/* Score + Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-3 flex flex-col items-center justify-center p-6 bg-card border rounded-xl shadow-sm">
          <div className="relative flex items-center justify-center">
            <svg className="w-32 h-32 transform -rotate-90">
              <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/40" />
              <circle
                cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8"
                strokeDasharray="351.8"
                strokeDashoffset={351.8 - (351.8 * analysis.overallScore) / 100}
                className="text-primary transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-bold font-mono" data-testid="overall-score">{analysis.overallScore}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Score</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-9 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground font-mono">Executive Summary</h3>
          <p className="text-lg md:text-xl font-serif leading-relaxed" data-testid="executive-summary">
            {analysis.executiveSummary}
          </p>
        </div>
      </div>

      {/* Detailed Analysis — dual render: accordion on screen, flat divs in print */}
      {sections && sections.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold font-serif border-b pb-2">Detailed Analysis</h2>

          {/* Screen: collapsible accordion */}
          <div className="no-print">
            <Accordion type="multiple" className="w-full space-y-4">
              {sections.map((section, idx) => (
                <AccordionItem key={idx} value={`section-${idx}`} className="border bg-card rounded-lg px-6 shadow-sm overflow-hidden">
                  <AccordionTrigger className="hover:no-underline py-6">
                    <div className="flex flex-1 items-center justify-between pr-4">
                      <h3 className="text-lg font-semibold text-left">{section.title}</h3>
                      {section.score != null && (
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${section.score}%` }} />
                          </div>
                          <span className="font-mono text-sm font-bold w-8 text-right">{section.score}</span>
                        </div>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-6 prose dark:prose-invert max-w-none text-muted-foreground">
                    <p className="leading-relaxed whitespace-pre-wrap">{section.content}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Print: flat divs always in DOM, shown only when printing */}
          <div className="print-only space-y-4">
            {sections.map((section, idx) => (
              <div key={idx} className="border bg-card rounded-lg px-6 py-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold">{section.title}</h3>
                  {section.score != null && (
                    <span className="font-mono text-sm font-bold">{section.score}/100</span>
                  )}
                </div>
                <p className="leading-relaxed whitespace-pre-wrap text-muted-foreground">{section.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Identified Findings */}
      {sortedFindings.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold font-serif border-b pb-2 flex items-center gap-3">
            Identified Findings
            <Badge variant="secondary" className="font-mono text-xs">{sortedFindings.length}</Badge>
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {sortedFindings.map((f, idx) => {
              const finding = f as Finding;
              const sev = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
              const Icon = sev.icon;
              return (
                <Card key={idx} className="p-5 border-l-4 overflow-hidden border-l-primary" data-testid={`finding-${idx}`}>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex flex-col gap-2 md:w-1/4 shrink-0">
                      <Badge variant="outline" className={`w-fit px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${sev.color}`}>
                        <Icon className="mr-1.5 h-3 w-3" /> {sev.label}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{finding.category}</span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <h4 className="text-base font-bold">{finding.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{finding.description}</p>
                      {finding.evidence && (
                        <div className="pl-4 border-l-2 border-primary/40 py-1 bg-muted/30 text-sm font-serif italic text-foreground/80">
                          "{finding.evidence}"
                        </div>
                      )}
                      {finding.recommendation && (
                        <div className="pt-3 border-t text-sm">
                          <span className="font-semibold mr-2">Recommendation:</span>
                          <span className="text-muted-foreground">{finding.recommendation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Citations & Reference Check */}
      {analysis.citations && (analysis.citations as Citation[]).length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold font-serif border-b pb-2">Citations & Reference Check</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(analysis.citations as Citation[]).map((citation, idx) => {
              const status = CITATION_STATUS_CONFIG[citation.status] || CITATION_STATUS_CONFIG.unavailable;
              return (
                <div key={idx} className="p-4 rounded-lg border bg-card/50 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${status.color}`}>
                      {status.label}
                    </Badge>
                    {citation.url && (
                      <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" /> Source
                      </a>
                    )}
                  </div>
                  <div className="font-mono text-xs p-2 bg-muted rounded text-foreground/80 break-words">
                    {citation.reference}
                  </div>
                  {citation.note && <p className="text-xs text-muted-foreground">{citation.note}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recommendations */}
      {analysis.recommendations && (analysis.recommendations as string[]).length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold font-serif border-b pb-2">Recommendations</h2>
          <ol className="space-y-3 list-none">
            {(analysis.recommendations as string[]).map((rec, idx) => (
              <li key={idx} className="flex gap-4 p-4 rounded-lg bg-card border">
                <span className="font-mono text-primary font-bold text-sm shrink-0 mt-0.5">{String(idx + 1).padStart(2, "0")}</span>
                <span className="text-sm text-muted-foreground leading-relaxed">{rec}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Rebuttal context banner — shown if this IS a rebuttal analysis */}
      {(analysis as Analysis & { parentAnalysisId?: number | null }).parentAnalysisId && (
        <div className="no-print flex items-start gap-3 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 text-sm text-muted-foreground">
          <CornerDownRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <span>
            This is a <span className="text-foreground font-semibold">rebuttal analysis</span> — a continuation of an earlier analysis on the same document.
          </span>
        </div>
      )}

      {/* Strategic Solutions */}
      <section className="pt-8 border-t border-border">
        {!showSolutions ? (
          <div className="no-print flex flex-col items-center justify-center p-12 rounded-xl border border-dashed bg-card/30 text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-bold font-serif">Generate Solutions</h3>
              <p className="text-sm text-muted-foreground">
                Deploy an AI agent to produce concrete solutions, mitigations, and strategic recommendations for every identified oversight.
              </p>
            </div>
            <Button size="lg" onClick={handleGetSolutions} data-testid="button-solutions" className="px-8 font-bold shadow-lg shadow-primary/20">
              <Shield className="mr-2 h-5 w-5" /> Generate Solutions
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold font-serif border-b pb-2 flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-primary" /> Strategic Solutions
            </h2>
            {isSolutionsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
              </div>
            ) : solutions?.solutions ? (
              <div className="grid gap-4">
                {solutions.solutions.map((sol, idx) => (
                  <Card key={idx} className="p-6 border-l-4 border-l-primary shadow-sm bg-card" data-testid={`solution-${idx}`}>
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="md:w-1/4 shrink-0 space-y-2">
                        <Badge
                          variant={sol.priority === "immediate" ? "destructive" : sol.priority === "short_term" ? "default" : "secondary"}
                        >
                          {sol.priority.replace("_", " ").toUpperCase()}
                        </Badge>
                        <h4 className="font-bold font-serif text-base leading-tight">{sol.oversightTitle}</h4>
                      </div>
                      <div className="flex-1 space-y-4">
                        <p className="text-sm leading-relaxed text-muted-foreground">{sol.solution}</p>
                        {sol.resources && sol.resources.length > 0 && (
                          <div className="bg-muted/50 p-3 rounded-md">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">Resources</span>
                            <ul className="list-disc pl-4 space-y-1">
                              {sol.resources.map((res, ridx) => (
                                <li key={ridx} className="text-xs text-foreground/80 font-mono">{res}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-muted-foreground">Failed to generate solutions.</div>
            )}
          </div>
        )}
      </section>
      {/* Rebuttal Composer — no-print, always shown */}
      <section className="no-print pt-8 border-t border-border space-y-4">
        {!showRebuttal ? (
          <div className="flex flex-col items-center justify-center p-10 rounded-xl border border-dashed bg-card/30 text-center space-y-5">
            <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center">
              <MessageSquareQuote className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="text-lg font-bold font-serif">Submit a Rebuttal</h3>
              <p className="text-sm text-muted-foreground">
                Challenge the findings. The AI will rigorously evaluate your counterargument against the original document and the analysis above.
              </p>
            </div>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setShowRebuttal(true)}
              className="gap-2 font-semibold"
            >
              <MessageSquareQuote className="h-4 w-4" />
              Write a Rebuttal
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <MessageSquareQuote className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold font-serif">Your Rebuttal</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Write your counterargument below. The AI will analyse how well it addresses the original findings and identify any new issues it raises.
            </p>
            <Textarea
              value={rebuttalText}
              onChange={(e) => setRebuttalText(e.target.value)}
              placeholder="Enter your rebuttal here — challenge specific findings, present new evidence, or contest the framing of the analysis…"
              className="min-h-[200px] font-serif text-base leading-relaxed resize-y"
              disabled={isSubmittingRebuttal}
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button
                variant="ghost"
                onClick={() => { setShowRebuttal(false); setRebuttalText(""); }}
                disabled={isSubmittingRebuttal}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-muted-foreground">
                  {rebuttalText.trim().split(/\s+/).filter(Boolean).length} words
                </span>
                <Button
                  onClick={() => void handleSubmitRebuttal()}
                  disabled={isSubmittingRebuttal || rebuttalText.trim().length < 10}
                  className="gap-2 font-semibold px-6"
                >
                  {isSubmittingRebuttal ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</>
                  ) : (
                    <><MessageSquareQuote className="h-4 w-4" /> Submit Rebuttal</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
}
