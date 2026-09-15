import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateAnalysis, getListAnalysesQueryKey, getGetAnalysisStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert, ShieldCheck, Eye, BookOpen, Fingerprint, Loader2,
  Code2, FileCode2, Braces, FileJson, Globe, Layers,
  Upload, FileText, X, CheckCircle2, ClipboardType, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLensTheme } from "@/contexts/lens-theme-context";

// ── Lens definitions ──────────────────────────────────────────────────────────
const SINGLE_LENSES = [
  {
    id: "red_team",
    title: "Red Team",
    description: "Adversarial critique. Finds every vulnerability, contradiction, and weak point.",
    icon: ShieldAlert,
    color: "text-red-500",
    border: "border-red-500",
    bg: "bg-red-500/5",
    hover: "hover:border-red-500/50 hover:bg-red-500/5",
  },
  {
    id: "blue_team",
    title: "Blue Team",
    description: "Defensive review. Strengthens arguments and bolsters evidence.",
    icon: ShieldCheck,
    color: "text-blue-500",
    border: "border-blue-500",
    bg: "bg-blue-500/5",
    hover: "hover:border-blue-500/50 hover:bg-blue-500/5",
  },
  {
    id: "symbolic",
    title: "Symbolic",
    description: "Decodes metaphors, archetypes, and underlying narrative structures.",
    icon: Fingerprint,
    color: "text-amber-400",
    border: "border-amber-400",
    bg: "bg-amber-400/5",
    hover: "hover:border-amber-400/50 hover:bg-amber-400/5",
  },
  {
    id: "philosophical",
    title: "Philosophical",
    description: "Epistemological analysis. Examines core assumptions and theoretical foundations.",
    icon: BookOpen,
    color: "text-violet-500",
    border: "border-violet-500",
    bg: "bg-violet-500/5",
    hover: "hover:border-violet-500/50 hover:bg-violet-500/5",
  },
] as const;

const CODE_TYPES = [
  { id: "code_python", label: "Python", icon: Code2, color: "text-sky-500", border: "border-sky-500", bg: "bg-sky-500/5", hover: "hover:border-sky-500/50 hover:bg-sky-500/5" },
  { id: "code_json",   label: "JSON",   icon: Braces, color: "text-emerald-500", border: "border-emerald-500", bg: "bg-emerald-500/5", hover: "hover:border-emerald-500/50 hover:bg-emerald-500/5" },
  { id: "code_yaml",   label: "YAML",   icon: FileCode2, color: "text-amber-500", border: "border-amber-500", bg: "bg-amber-500/5", hover: "hover:border-amber-500/50 hover:bg-amber-500/5" },
  { id: "code_html",   label: "HTML",   icon: Globe, color: "text-orange-500", border: "border-orange-500", bg: "bg-orange-500/5", hover: "hover:border-orange-500/50 hover:bg-orange-500/5" },
] as const;

// ── Schema ────────────────────────────────────────────────────────────────────
const formSchema = z.object({
  title: z.string().optional(),
  documentText: z.string().min(10, "Document must be at least 10 characters."),
  lens: z.string().min(1, "Select at least one lens."),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function computeLens(mode: "document" | "code", selectedLenses: string[], codeType: string, isAutoDetect: boolean): string {
  if (mode === "code") return codeType;
  if (isAutoDetect) return "auto";
  if (selectedLenses.length === 0) return "red_team";
  return [...selectedLenses].sort().join("+");
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface AnalysisFormProps {
  onAnalysisCreated: (id: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AnalysisForm({ onAnalysisCreated }: AnalysisFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createAnalysis = useCreateAnalysis();
  const { setActiveLens } = useLensTheme();

  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [mode, setMode] = useState<"document" | "code">("document");
  const [selectedLenses, setSelectedLenses] = useState<string[]>(["red_team"]);
  const [isAutoDetect, setIsAutoDetect] = useState(false);
  const [codeType, setCodeType] = useState("code_python");
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  // File upload state
  const [inputMethod, setInputMethod] = useState<"paste" | "upload">("paste");
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parsedFilename, setParsedFilename] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", documentText: "", lens: "red_team" },
  });

  const textValue = form.watch("documentText");

  // Live counts
  useEffect(() => {
    if (!textValue) { setWordCount(0); setCharCount(0); return; }
    setCharCount([...textValue].length);
    setWordCount(textValue.trim().split(/\s+/).filter(Boolean).length);
  }, [textValue]);

  // Keep form lens in sync + drive theme
  useEffect(() => {
    const lens = computeLens(mode, selectedLenses, codeType, isAutoDetect);
    form.setValue("lens", lens);
    setActiveLens(lens);
  }, [mode, selectedLenses, codeType, isAutoDetect, form, setActiveLens]);

  // Toggle a single lens (multi-select)
  const toggleLens = (id: string) => {
    setSelectedLenses((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== id);
      }
      return [...prev, id];
    });
  };

  // ── File upload ─────────────────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    setIsParsingFile(true);
    setParsedFilename(null);

    // Auto-fill title from filename if empty
    const currentTitle = form.getValues("title");
    if (!currentTitle) {
      const guessedTitle = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      form.setValue("title", guessedTitle);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/parse-document", { method: "POST", body: formData });
      const json = await res.json() as { text?: string; filename?: string; error?: string };

      if (!res.ok) {
        throw new Error(json.error ?? "Extraction failed");
      }

      form.setValue("documentText", json.text ?? "", { shouldValidate: true });
      setParsedFilename(json.filename ?? file.name);
      setInputMethod("paste"); // switch to text view so user can see/edit
    } catch (err) {
      toast({
        title: "File parse failed",
        description: err instanceof Error ? err.message : "Could not read this file.",
        variant: "destructive",
      });
    } finally {
      setIsParsingFile(false);
    }
  }, [form, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }, [processFile]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createAnalysis.mutate(
      { data: { documentText: values.documentText, title: values.title, lens: values.lens } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAnalysisStatsQueryKey() });
          onAnalysisCreated(data.id);
        },
        onError: (error) => {
          toast({
            title: "Analysis Failed",
            description: (error as { error?: string }).error || "An unexpected error occurred.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const isPending = createAnalysis.isPending;
  const isHtmlMode = mode === "code" && codeType === "code_html";

  return (
    <div className="max-w-4xl mx-auto p-8 pt-12 relative">
      {/* Loading overlay */}
      <AnimatePresence>
        {isPending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div className="flex flex-col items-center space-y-6 max-w-sm text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <Eye className="h-16 w-16 text-primary animate-pulse relative z-10" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-bold">Analyzing Document</h3>
                <p className="text-sm text-muted-foreground">
                  Running deep critical analysis across the selected lens{selectedLenses.length > 1 ? "es" : ""}. This typically takes 20–30 seconds.
                </p>
              </div>
              <div className="w-full flex items-center justify-center gap-2 text-primary text-sm font-mono">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing…
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-10 text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">
          The Pen Is <span className="text-primary italic">Red</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Advanced document red-teaming. Submit any text, code, or structured data for rigorous, multi-lens assessment.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Document Title (Optional)"
                    className="text-lg font-serif bg-transparent border-t-0 border-l-0 border-r-0 border-b-2 rounded-none focus-visible:ring-0 focus-visible:border-primary px-0 h-14"
                    {...field}
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Mode toggle */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Analysis Mode</label>
            <div className="flex gap-3">
              <button
                type="button"
                data-testid="mode-document"
                onClick={() => setMode("document")}
                disabled={isPending}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all duration-200 ${
                  mode === "document"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <Layers className="h-4 w-4" />
                Document / Text
              </button>
              <button
                type="button"
                data-testid="mode-code"
                onClick={() => setMode("code")}
                disabled={isPending}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all duration-200 ${
                  mode === "code"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-card text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <FileJson className="h-4 w-4" />
                Code / Structured Data
              </button>
            </div>
          </div>

          {/* Document mode: multi-select lenses */}
          {mode === "document" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-sm font-medium text-foreground">Analysis Lens</label>
                <div className="flex items-center gap-3">
                  {!isAutoDetect && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {selectedLenses.length > 1 ? `${selectedLenses.length} lenses combined` : "Select one or more"}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setIsAutoDetect((v) => !v); }}
                    disabled={isPending}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 ${
                      isAutoDetect
                        ? "border-slate-400 bg-slate-400/10 text-slate-300"
                        : "border-border/50 text-muted-foreground hover:border-slate-400/50 hover:text-slate-300"
                    } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    {isAutoDetect ? "Auto-detecting" : "Let system choose"}
                  </button>
                </div>
              </div>

              {isAutoDetect && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-slate-500/30 bg-slate-500/5 text-sm text-muted-foreground">
                  <Wand2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <span>
                    The AI will read your document and select the most appropriate lens automatically before beginning the full analysis.
                  </span>
                </div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 transition-opacity duration-200 ${isAutoDetect ? "opacity-40 pointer-events-none" : ""}`}>
                {SINGLE_LENSES.map((lens) => {
                  const active = selectedLenses.includes(lens.id) && !isAutoDetect;
                  return (
                    <button
                      key={lens.id}
                      type="button"
                      data-testid={`lens-${lens.id}`}
                      onClick={() => !isPending && !isAutoDetect && toggleLens(lens.id)}
                      disabled={isPending || isAutoDetect}
                      className={`p-4 rounded-xl border-2 cursor-pointer text-left transition-all duration-200 ${
                        active
                          ? `${lens.border} ${lens.bg}`
                          : `border-border/50 bg-card ${lens.hover}`
                      } ${isPending || isAutoDetect ? "cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${active ? lens.color : "text-muted-foreground"}`}>
                          <lens.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={`font-semibold text-sm ${active ? "text-foreground" : "text-foreground/70"}`}>
                              {lens.title}
                            </h4>
                            {active && (
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${lens.color} bg-current/10`}
                                style={{ backgroundColor: "currentColor", opacity: 0.15 }}
                              >
                                <span className={lens.color}>ON</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{lens.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {!isAutoDetect && selectedLenses.length > 1 && (
                <p className="text-xs text-muted-foreground font-mono pl-1">
                  Combined lens: <span className="text-primary">{[...selectedLenses].sort().join(" + ").replace(/_/g, " ")}</span>
                </p>
              )}
            </div>
          )}

          {/* Code mode: code type selector */}
          {mode === "code" && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Code Type</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CODE_TYPES.map((ct) => {
                  const active = codeType === ct.id;
                  return (
                    <button
                      key={ct.id}
                      type="button"
                      data-testid={`codetype-${ct.id}`}
                      onClick={() => !isPending && setCodeType(ct.id)}
                      disabled={isPending}
                      className={`p-3 rounded-xl border-2 cursor-pointer text-left transition-all duration-200 ${
                        active ? `${ct.border} ${ct.bg}` : `border-border/50 bg-card ${ct.hover}`
                      } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className={`mb-1.5 ${active ? ct.color : "text-muted-foreground"}`}>
                        <ct.icon className="h-5 w-5" />
                      </div>
                      <div className={`text-sm font-semibold ${active ? "text-foreground" : "text-foreground/70"}`}>
                        {ct.label}
                      </div>
                    </button>
                  );
                })}
              </div>
              {isHtmlMode && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowHtmlPreview((v) => !v)}
                    className="text-xs font-mono text-primary underline underline-offset-2"
                  >
                    {showHtmlPreview ? "Hide" : "Show"} live HTML preview
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Document content — paste vs upload tabs */}
          <FormField
            control={form.control}
            name="documentText"
            render={({ field }) => (
              <FormItem className="space-y-2">
                {/* Header row */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-card p-0.5">
                    <button
                      type="button"
                      onClick={() => setInputMethod("paste")}
                      disabled={isPending}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
                        inputMethod === "paste"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <ClipboardType className="h-3.5 w-3.5" />
                      Paste / Type
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMethod("upload")}
                      disabled={isPending}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
                        inputMethod === "upload"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload File
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {parsedFilename && (
                      <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-500">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="max-w-[160px] truncate">{parsedFilename}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setParsedFilename(null);
                            form.setValue("documentText", "");
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Clear file"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                      <span data-testid="word-count">{wordCount} words</span>
                      <span data-testid="char-count">{charCount} chars</span>
                    </div>
                  </div>
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.md,.mdx,.markdown,.csv,.tsv,.json,.jsonl,.yaml,.yml,.toml,.ini,.xml,.html,.htm,.svg,.js,.jsx,.ts,.tsx,.py,.rb,.rs,.go,.java,.c,.cpp,.h,.cs,.swift,.kt,.php,.sh,.sql,.graphql,.r,.log,.rtf"
                  onChange={handleFileChange}
                  disabled={isPending || isParsingFile}
                />

                {/* Upload drop zone */}
                {inputMethod === "upload" && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => !isParsingFile && !isPending && fileInputRef.current?.click()}
                    className={`relative min-h-[260px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 select-none ${
                      isDragOver
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card"
                    } ${(isParsingFile || isPending) ? "pointer-events-none opacity-70" : ""}`}
                  >
                    {isParsingFile ? (
                      <>
                        <Loader2 className="h-10 w-10 text-primary animate-spin" />
                        <p className="text-sm font-medium text-muted-foreground">Extracting text…</p>
                      </>
                    ) : (
                      <>
                        <div className="rounded-full bg-primary/10 p-4">
                          <Upload className="h-8 w-8 text-primary" />
                        </div>
                        <div className="text-center space-y-1 px-6">
                          <p className="text-sm font-semibold text-foreground">
                            Drop a file here, or click to browse
                          </p>
                          <p className="text-xs text-muted-foreground">
                            PDF, DOCX, TXT, MD, CSV, JSON, YAML, HTML, code files and more
                          </p>
                          <p className="text-xs text-muted-foreground/70 pt-1">
                            No size limit — text will be extracted and shown for review before analysis
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-1.5 px-8 max-w-md">
                          {["PDF", "DOCX", "TXT", "MD", "CSV", "JSON", "YAML", "HTML", "PY", "TS", "RS", "GO"].map((fmt) => (
                            <span key={fmt} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
                              {fmt}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Paste / text area */}
                {inputMethod === "paste" && (
                  isHtmlMode && showHtmlPreview ? (
                    <div className="grid grid-cols-2 gap-3 border rounded-xl overflow-hidden">
                      <FormControl>
                        <Textarea
                          placeholder="Paste your HTML here..."
                          className="min-h-[340px] resize-none font-mono text-sm leading-relaxed p-4 bg-card/50 border-0 rounded-none focus-visible:ring-0"
                          {...field}
                          disabled={isPending}
                          data-testid="document-textarea"
                        />
                      </FormControl>
                      <div className="bg-white border-l">
                        <div className="px-3 py-1.5 bg-muted/50 text-xs font-mono text-muted-foreground border-b">
                          Live Preview
                        </div>
                        <iframe
                          srcDoc={textValue || "<p style='color:#888;font-family:sans-serif;padding:1rem'>HTML preview will appear here...</p>"}
                          title="HTML Preview"
                          className="w-full"
                          style={{ height: "calc(340px - 30px)" }}
                          sandbox="allow-scripts"
                        />
                      </div>
                    </div>
                  ) : (
                    <FormControl>
                      <Textarea
                        placeholder={
                          parsedFilename
                            ? `Extracted from ${parsedFilename} — review and edit before running analysis…`
                            : mode === "code"
                              ? `Paste your ${CODE_TYPES.find(c => c.id === codeType)?.label ?? "code"} here…`
                              : "Paste your document, manifesto, policy, research paper, or any text here…"
                        }
                        className="min-h-[300px] resize-y font-mono text-sm leading-relaxed p-6 bg-card/50"
                        {...field}
                        disabled={isPending}
                        data-testid="document-textarea"
                      />
                    </FormControl>
                  )
                )}

                {/* Show a preview of extracted text even when in upload tab (after extraction switches to paste) */}
                {inputMethod === "upload" && parsedFilename && textValue && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
                    <FileText className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>Text extracted — switch to <button type="button" onClick={() => setInputMethod("paste")} className="text-primary underline underline-offset-2">Paste / Type</button> to review or edit before submitting.</span>
                  </div>
                )}

                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              size="lg"
              data-testid="button-submit"
              className="w-full md:w-auto px-12 h-14 text-lg font-bold tracking-wide shadow-lg hover:shadow-primary/25 transition-all bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isPending || isParsingFile}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Initiating Analysis
                </>
              ) : (
                "Run Analysis"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
