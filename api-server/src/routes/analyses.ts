import { Router } from "express";
import { randomUUID } from "crypto";
import { db, pool } from "@workspace/db";
import { analyses, rateLimits } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { eq, desc, and, or, isNull, sql } from "drizzle-orm";
import {
  CreateAnalysisBody,
  GetAnalysisParams,
  DeleteAnalysisParams,
  GetAnalysisSolutionsParams,
} from "@workspace/api-zod";

const router = Router();

const TOKEN_COOKIE = "clientToken";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "strict" as const,
  maxAge: 365 * 24 * 60 * 60 * 1000,
};

// ── Atomic IP-keyed quota (Postgres UPSERT — race-safe) ───────────────────────

const CREATE_LIMIT = 5;
const CREATE_WINDOW_MS = 10 * 60 * 1000;

const SOLUTIONS_LIMIT = 10;
const SOLUTIONS_WINDOW_MS = 10 * 60 * 1000;

async function checkAndIncrementQuota(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  // Single atomic statement: insert or update counter, reset when window expired.
  // Returns the counter value AFTER the increment so no separate read is needed.
  const result = await db.execute(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, NOW(), 1)
    ON CONFLICT (key) DO UPDATE SET
      window_start = CASE
        WHEN rate_limits.window_start + (${windowMs} || ' milliseconds')::interval <= NOW()
        THEN NOW()
        ELSE rate_limits.window_start
      END,
      count = CASE
        WHEN rate_limits.window_start + (${windowMs} || ' milliseconds')::interval <= NOW()
        THEN 1
        ELSE rate_limits.count + 1
      END
    RETURNING count
  `);
  const count = (result.rows[0] as { count: number } | undefined)?.count ?? 1;
  return count <= limit;
}

// ── Postgres advisory lock for solutions (prevents concurrent duplicate AI calls) ─

async function withSolutionsLock<T>(
  analysisId: number,
  fn: () => Promise<T>,
): Promise<{ acquired: boolean; result?: T }> {
  const client = await pool.connect();
  try {
    const lockResult = await client.query(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [analysisId],
    );
    const acquired = lockResult.rows[0]?.acquired as boolean;
    if (!acquired) return { acquired: false };
    try {
      const result = await fn();
      return { acquired: true, result };
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [analysisId]);
    }
  } finally {
    client.release();
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────────

function getOrCreateToken(req: import("express").Request, res: import("express").Response): string {
  const existing = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (existing && existing.length > 0) return existing;
  const token = randomUUID();
  res.cookie(TOKEN_COOKIE, token, COOKIE_OPTS);
  return token;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countChars(text: string): number {
  return [...text].length;
}

// ── System prompt builder ─────────────────────────────────────────────────────

const BASE = `You are an expert document analyst for "The Pen Is Red" platform — a professional red-teaming and document assessment service. You have encyclopaedic knowledge spanning science, law, philosophy, literature, cybersecurity, medicine, history, technology, linguistics, and more. You can read and analyse text in any human language, programming language, structured data format, or glyph alphabet with equal precision.`;

const LENS_PROMPTS: Record<string, string> = {
  red_team: `\nRED TEAM LENS — Your role is adversarial. Seek out every vulnerability, gap, weakness, contradiction, logical flaw, unsupported claim, and potential exploit. Think like an attacker, a rigorous sceptic, a hostile expert reviewer. Find what the author missed, glossed over, or got wrong. Assess: methodology weaknesses, statistical and logical errors, unsupported claims, missing evidence, all forms of bias (confirmation, selection, publication, funding), security and risk implications, alternative explanations the author ignored, and citations that may be weak, outdated, or misrepresented.`,

  blue_team: `\nBLUE TEAM LENS — Your role is defensive and constructive. Strengthen and protect the document's arguments. Identify weaknesses to help the author improve, find supporting evidence they may have missed, suggest mitigations, and propose how to bolster the document's defences against criticism. Assess: what the document gets right and why, defensive strategies against common critiques, additional supporting evidence and citations, risk mitigations, how to harden methodology and claims, and gaps that if filled would significantly strengthen the work.`,

  symbolic: `\nSYMBOLIC LENS — Go beyond the literal text and decode the deeper symbolic meaning, recurring motifs, metaphors, archetypes, and hidden layers. Consider: symbolic patterns, archetypes, and motifs in language and structure; how metaphors and imagery construct the document's underlying worldview; Jungian, mythological, or cultural symbolic frameworks at play; the symbolic implications of what is emphasised, de-emphasised, or absent; intertextual resonances with literature, myth, religion, and art; and how the document's symbolism shapes its persuasive power or subconscious framing.`,

  philosophical: `\nPHILOSOPHICAL LENS — Examine the document through the lens of philosophy, epistemology, and conceptual critique. Consider: the epistemological foundations and assumptions underlying the claims; ontological commitments and what the document presupposes about reality; ethical and normative dimensions — what values are implicit or explicit; philosophical frameworks (phenomenology, critical theory, pragmatism, analytic philosophy) applicable to the subject; conceptual tensions, paradoxes, and internal contradictions; whether conclusions follow necessarily from premises; alternative philosophical traditions that would interpret the evidence differently; and the broader intellectual and cultural context of the ideas.`,
};

const CODE_PROMPTS: Record<string, string> = {
  code_python: `\nPYTHON CODE ANALYSIS — Perform a deep technical and qualitative analysis of this Python code. Assess: code correctness and potential runtime errors; security vulnerabilities (injection, insecure deserialization, hardcoded secrets, unsafe imports); algorithmic complexity and performance; Pythonic idioms and adherence to PEP 8 / best practices; dependency risks and version compatibility; test coverage and error handling; data flow and potential edge cases; documentation quality; and architectural / design pattern concerns.`,

  code_json: `\nJSON ANALYSIS — Perform a deep structural and semantic analysis of this JSON document. Assess: schema validity and structural correctness; data type mismatches and null-safety risks; missing required fields or unexpected optional fields; deeply nested structures that could cause parsing issues; encoding and special character handling; potential injection or security risks if this JSON is consumed by an application; semantic consistency of the values; naming conventions; and whether the structure follows relevant standards or schemas (e.g., JSON Schema, GeoJSON, JSON-LD, OpenAPI).`,

  code_yaml: `\nYAML ANALYSIS — Perform a deep structural and semantic analysis of this YAML document. Assess: syntactic correctness and indentation consistency; type coercion pitfalls (the Norway problem, booleans, null values); anchor/alias usage and potential merge key issues; security risks (YAML bombs, arbitrary code execution vectors in unsafe loaders); missing or redundant keys; adherence to any relevant schema (Kubernetes manifests, Docker Compose, GitHub Actions, etc.); environment variable interpolation risks; and semantic consistency of the configuration values.`,

  code_html: `\nHTML ANALYSIS — Perform a deep structural, semantic, and security analysis of this HTML document. Assess: semantic correctness and use of appropriate HTML5 elements; accessibility (WCAG 2.1 compliance, ARIA roles, alt text, keyboard navigation); XSS and injection vulnerabilities; meta tags, SEO completeness, and Open Graph data; inline script and style security implications; form security (CSRF, action attributes, input validation); cross-browser compatibility concerns; performance issues (render-blocking resources, unoptimised images, missing lazy loading); and standards compliance.`,
};

function getLensSystemPrompt(lens: string): string {
  const segments = lens.split("+").map((s) => s.trim().toLowerCase());

  if (segments.length === 1 && segments[0].startsWith("code_")) {
    const codePart = CODE_PROMPTS[segments[0]];
    return codePart
      ? `${BASE}${codePart}`
      : `${BASE}\nAnalyse the code or structured data thoroughly, covering correctness, security, performance, and best practices.`;
  }

  const parts = segments.map((s) => LENS_PROMPTS[s]).filter(Boolean);
  if (parts.length === 0) return BASE;
  if (parts.length === 1) return `${BASE}${parts[0]}`;

  const combined = parts.join("\n");
  return `${BASE}

You are performing a COMBINED MULTI-LENS analysis. Apply every lens listed below with full rigour — each perspective must be covered in depth. Do not collapse or abbreviate any lens. Synthesise findings where lenses intersect.
${combined}`;
}

function getLensUserPrompt(lens: string, documentText: string): string {
  const segments = lens.split("+").map((s) => s.trim().toLowerCase());
  const isCode = segments.length === 1 && segments[0].startsWith("code_");

  const sectionHints = isCode
    ? `Code analysis sections should include as many of the following as are relevant:
- Code Overview & Purpose
- Structural Analysis
- Security Assessment
- Performance & Complexity
- Best Practices & Style
- Error Handling & Edge Cases
- Dependency & Compatibility
- Documentation Quality
- Recommendations`
    : segments.length > 1
    ? `Analysis sections should cover all of the following lenses in depth:
${segments.map((s) => `- ${(s.charAt(0).toUpperCase() + s.slice(1)).replace("_", " ")} perspective`).join("\n")}
Plus cross-lens synthesis where perspectives intersect.`
    : `Analysis sections should include 5–8 of the following as relevant:
- Executive Overview, Structural Integrity, Logical Coherence, Evidentiary Strength
- Statistical / Methodological Assessment, Bias Detection, Citation Quality
- Risk & Vulnerability Assessment, Alternative Perspectives
- Conceptual Frameworks (philosophical), Symbolic Patterns (symbolic)
- Defensive Posture (blue team)`;

  return `Analyse the following document thoroughly. Return a structured JSON response with this exact schema:

{
  "overallScore": <number 0–100>,
  "confidenceLevel": "High" | "Medium" | "Low",
  "executiveSummary": "<2–4 sentence synthesis of the most important findings>",
  "sections": [
    {
      "title": "<section name>",
      "content": "<detailed analysis paragraph — minimum 3 sentences>",
      "score": <number 0–100 or null>,
      "findings": []
    }
  ],
  "findings": [
    {
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "<category name>",
      "title": "<short finding title>",
      "description": "<detailed description — minimum 2 sentences>",
      "evidence": "<direct quote or reference from the document, or null>",
      "recommendation": "<specific actionable recommendation, or null>"
    }
  ],
  "citations": [
    {
      "reference": "<full citation text>",
      "status": "verified" | "unverified" | "disputed" | "unavailable",
      "note": "<verification note or null>",
      "url": "<URL if known or null>"
    }
  ],
  "recommendations": ["<actionable string>"]
}

${sectionHints}

Be detailed, rigorous, and precise. Draw on your knowledge of comparable works, counter-evidence, and domain best practices. Return ONLY the JSON object, no other text.

DOCUMENT TO ANALYSE:
---
${documentText}
---`;
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/analyses", async (req, res) => {
  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) {
    res.json([]);
    return;
  }

  const rows = await db
    .select({
      id: analyses.id,
      title: analyses.title,
      lens: analyses.lens,
      createdAt: analyses.createdAt,
      wordCount: analyses.wordCount,
      charCount: analyses.charCount,
      overallScore: analyses.overallScore,
      findings: analyses.findings,
    })
    .from(analyses)
    .where(eq(analyses.clientToken, token))
    .orderBy(desc(analyses.createdAt));

  const result = rows.map((r) => {
    const findings = (r.findings as Array<{ severity: string }>) || [];
    return {
      id: r.id,
      title: r.title,
      lens: r.lens,
      createdAt: r.createdAt,
      wordCount: r.wordCount,
      charCount: r.charCount,
      overallScore: r.overallScore,
      findingsCounts: {
        critical: findings.filter((f) => f.severity === "critical").length,
        high: findings.filter((f) => f.severity === "high").length,
        medium: findings.filter((f) => f.severity === "medium").length,
        low: findings.filter((f) => f.severity === "low").length,
      },
    };
  });

  res.json(result);
});

router.post("/analyses", async (req, res) => {
  const parsed = CreateAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const ip = req.ip ?? "unknown";
  const allowed = await checkAndIncrementQuota(
    `create:${ip}`,
    CREATE_LIMIT,
    CREATE_WINDOW_MS,
  );
  if (!allowed) {
    res.status(429).json({
      error: `Rate limit exceeded: at most ${CREATE_LIMIT} analyses per 10 minutes per IP.`,
    });
    return;
  }

  const token = getOrCreateToken(req, res);

  const { documentText, lens: rawLens, title } = parsed.data;

  // ── Auto-detect: resolve the best lens via a fast classification call ────────
  let lens = rawLens;
  if (rawLens === "auto") {
    try {
      const classifyResp = await openai.chat.completions.create({
        model: "gpt-5.4",
        max_completion_tokens: 150,
        messages: [
          {
            role: "system",
            content:
              "You are a document classification expert. Choose the most appropriate analysis lens(es) for the document. Available values: red_team (adversarial, vulnerabilities, weaknesses), blue_team (defensive, constructive), symbolic (metaphor, narrative, archetypes), philosophical (epistemology, ethics, assumptions). You may combine two lenses with + (e.g. red_team+philosophical). Return ONLY a JSON object: {\"lens\": \"<value>\", \"reason\": \"<one sentence>\"}",
          },
          {
            role: "user",
            content: `Classify this document and pick the best lens:\n\n${documentText.substring(0, 2000)}`,
          },
        ],
      });
      const classifyRaw = classifyResp.choices[0]?.message?.content ?? "{}";
      const classifyMatch = classifyRaw.match(/\{[\s\S]*\}/);
      if (classifyMatch) {
        const classifyData = JSON.parse(classifyMatch[0]) as { lens?: string };
        const validSegments = new Set(["red_team", "blue_team", "symbolic", "philosophical"]);
        const proposed = (classifyData.lens ?? "").trim();
        const isValid =
          proposed.length > 0 &&
          proposed.split("+").every((s) => validSegments.has(s.trim()));
        lens = isValid ? proposed : "red_team";
      } else {
        lens = "red_team";
      }
    } catch {
      lens = "red_team";
    }
  }

  const wordCount = countWords(documentText);
  const charCount = countChars(documentText);
  const docTitle =
    title ||
    documentText.trim().split(/\s+/).slice(0, 8).join(" ").substring(0, 80) +
      (wordCount > 8 ? "…" : "");

  const systemPrompt = getLensSystemPrompt(lens);
  const userPrompt = getLensUserPrompt(lens, documentText);

  let rawContent = "";
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 6000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    req.log.error({ err }, "OpenAI request failed");
    res.status(500).json({ error: "AI analysis failed" });
    return;
  }

  let analysisData: {
    overallScore: number;
    confidenceLevel?: string;
    executiveSummary: string;
    sections: unknown[];
    findings: unknown[];
    citations: unknown[];
    recommendations: string[];
  };

  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    analysisData = JSON.parse(jsonMatch[0]);
  } catch {
    req.log.error({ rawContent }, "Failed to parse AI response");
    analysisData = {
      overallScore: 50,
      executiveSummary: "Analysis completed. Structured parsing failed — raw output stored.",
      sections: [{ title: "Raw Analysis", content: rawContent, score: null, findings: [] }],
      findings: [],
      citations: [],
      recommendations: ["Review the raw analysis output above."],
    };
  }

  const [inserted] = await db
    .insert(analyses)
    .values({
      title: docTitle,
      lens,
      documentText,
      wordCount,
      charCount,
      overallScore: analysisData.overallScore ?? 50,
      confidenceLevel: analysisData.confidenceLevel ?? null,
      executiveSummary: analysisData.executiveSummary ?? "",
      sections: analysisData.sections ?? [],
      findings: analysisData.findings ?? [],
      citations: analysisData.citations ?? [],
      recommendations: analysisData.recommendations ?? [],
      clientToken: token,
    })
    .returning();

  const findingsArr = (inserted.findings as Array<{ severity: string }>) ?? [];

  res.status(201).json({
    id: inserted.id,
    title: inserted.title,
    lens: inserted.lens,
    createdAt: inserted.createdAt,
    wordCount: inserted.wordCount,
    charCount: inserted.charCount,
    overallScore: inserted.overallScore,
    confidenceLevel: inserted.confidenceLevel,
    executiveSummary: inserted.executiveSummary,
    sections: inserted.sections,
    findings: inserted.findings,
    citations: inserted.citations,
    recommendations: inserted.recommendations,
    documentText: inserted.documentText,
    findingsCounts: {
      critical: findingsArr.filter((f) => f.severity === "critical").length,
      high: findingsArr.filter((f) => f.severity === "high").length,
      medium: findingsArr.filter((f) => f.severity === "medium").length,
      low: findingsArr.filter((f) => f.severity === "low").length,
    },
  });
});

router.get("/analyses/stats", async (req, res) => {
  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) {
    res.json({ totalAnalyses: 0, byLens: {}, avgScore: 0, totalFindings: 0, recentAnalyses: [] });
    return;
  }

  const rows = await db
    .select({
      id: analyses.id,
      title: analyses.title,
      lens: analyses.lens,
      createdAt: analyses.createdAt,
      wordCount: analyses.wordCount,
      charCount: analyses.charCount,
      overallScore: analyses.overallScore,
      findings: analyses.findings,
    })
    .from(analyses)
    .where(eq(analyses.clientToken, token))
    .orderBy(desc(analyses.createdAt));

  const total = rows.length;
  const avgScore = total > 0 ? rows.reduce((s, r) => s + r.overallScore, 0) / total : 0;
  const byLens = { red_team: 0, blue_team: 0, symbolic: 0, philosophical: 0 } as Record<string, number>;
  let totalFindings = 0;

  for (const row of rows) {
    byLens[row.lens] = (byLens[row.lens] ?? 0) + 1;
    totalFindings += ((row.findings as Array<unknown>) || []).length;
  }

  const recentAnalyses = rows.slice(0, 5).map((r) => {
    const findings = (r.findings as Array<{ severity: string }>) || [];
    return {
      id: r.id,
      title: r.title,
      lens: r.lens,
      createdAt: r.createdAt,
      wordCount: r.wordCount,
      charCount: r.charCount,
      overallScore: r.overallScore,
      findingsCounts: {
        critical: findings.filter((f) => f.severity === "critical").length,
        high: findings.filter((f) => f.severity === "high").length,
        medium: findings.filter((f) => f.severity === "medium").length,
        low: findings.filter((f) => f.severity === "low").length,
      },
    };
  });

  res.json({ totalAnalyses: total, byLens, avgScore, totalFindings, recentAnalyses });
});

router.get("/analyses/:id", async (req, res) => {
  const params = GetAnalysisParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) { res.status(403).json({ error: "Forbidden" }); return; }

  const [row] = await db
    .select()
    .from(analyses)
    .where(and(eq(analyses.id, params.data.id), eq(analyses.clientToken, token)));
  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  res.json({
    id: row.id, title: row.title, lens: row.lens, createdAt: row.createdAt,
    wordCount: row.wordCount, charCount: row.charCount, overallScore: row.overallScore,
    confidenceLevel: row.confidenceLevel, executiveSummary: row.executiveSummary,
    sections: row.sections, findings: row.findings, citations: row.citations,
    recommendations: row.recommendations, documentText: row.documentText,
    parentAnalysisId: row.parentAnalysisId ?? null,
  });
});

router.delete("/analyses/:id", async (req, res) => {
  const params = DeleteAnalysisParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) { res.status(403).json({ error: "Forbidden" }); return; }

  const [deleted] = await db
    .delete(analyses)
    .where(and(eq(analyses.id, params.data.id), eq(analyses.clientToken, token)))
    .returning({ id: analyses.id });
  if (!deleted) { res.status(404).json({ error: "Analysis not found" }); return; }

  res.status(204).send();
});

router.get("/analyses/:id/solutions", async (req, res) => {
  const params = GetAnalysisSolutionsParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) { res.status(403).json({ error: "Forbidden" }); return; }

  const [row] = await db
    .select()
    .from(analyses)
    .where(and(
      eq(analyses.id, params.data.id),
      or(isNull(analyses.clientToken), eq(analyses.clientToken, token)),
    ));
  if (!row) { res.status(404).json({ error: "Analysis not found" }); return; }

  if (row.cachedSolutions) {
    res.json({ analysisId: row.id, solutions: row.cachedSolutions });
    return;
  }

  const ip = req.ip ?? "unknown";
  const quotaAllowed = await checkAndIncrementQuota(
    `solutions:${ip}`,
    SOLUTIONS_LIMIT,
    SOLUTIONS_WINDOW_MS,
  );
  if (!quotaAllowed) {
    res.status(429).json({
      error: `Rate limit exceeded: at most ${SOLUTIONS_LIMIT} solution generations per 10 minutes per IP.`,
    });
    return;
  }

  const { acquired, result } = await withSolutionsLock(row.id, async () => {
    const [fresh] = await db
      .select({ cachedSolutions: analyses.cachedSolutions })
      .from(analyses)
      .where(eq(analyses.id, row.id));
    if (fresh?.cachedSolutions) {
      return { cached: true, data: fresh.cachedSolutions };
    }

    const findings = (row.findings as Array<{ title: string; description: string; severity: string }>) ?? [];
    const recommendations = (row.recommendations as string[]) ?? [];

    const prompt = `Given the following analysis findings and recommendations for a document titled "${row.title}" (analysed with lens: ${row.lens}), generate specific, actionable solutions for each major oversight or issue identified.

FINDINGS:
${JSON.stringify(findings.slice(0, 10), null, 2)}

RECOMMENDATIONS:
${recommendations.join("\n")}

Return a JSON array of solution objects:
[
  {
    "oversightTitle": "<finding or recommendation title>",
    "solution": "<detailed, specific, actionable solution — minimum 3 sentences>",
    "priority": "immediate" | "short_term" | "long_term",
    "resources": ["<resource or reference>"]
  }
]

Return ONLY the JSON array, no other text.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 3000,
      messages: [
        {
          role: "system",
          content: "You are a senior expert consultant. Provide specific, actionable, high-quality solutions. Draw on the latest best practices, research methodologies, and domain expertise. Be concrete and precise.",
        },
        { role: "user", content: prompt },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const solutionsData = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    await db
      .update(analyses)
      .set({ cachedSolutions: solutionsData, solutionsGeneratedAt: new Date() })
      .where(eq(analyses.id, row.id));

    return { cached: false, data: solutionsData };
  });

  if (!acquired) {
    res
      .status(409)
      .json({ error: "Solutions are being generated for this analysis. Please retry in a moment." });
    return;
  }

  res.json({ analysisId: row.id, solutions: result!.data });
});

// ── POST /analyses/:id/rebuttal — continuation analysis against original findings ──
router.post("/analyses/:id/rebuttal", async (req, res) => {
  const params = GetAnalysisSolutionsParams.safeParse({ id: Number(req.params.id) });
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const token = req.cookies?.[TOKEN_COOKIE] as string | undefined;
  if (!token) { res.status(403).json({ error: "Forbidden" }); return; }

  const rebuttalText = typeof req.body?.rebuttalText === "string" ? (req.body.rebuttalText as string).trim() : null;
  const requestedLens = typeof req.body?.lens === "string" ? (req.body.lens as string).trim() : null;

  if (!rebuttalText || rebuttalText.length < 10) {
    res.status(400).json({ error: "rebuttalText must be at least 10 characters" });
    return;
  }

  const [parentRow] = await db
    .select()
    .from(analyses)
    .where(and(
      eq(analyses.id, params.data.id),
      or(isNull(analyses.clientToken), eq(analyses.clientToken, token)),
    ));
  if (!parentRow) { res.status(404).json({ error: "Analysis not found" }); return; }

  const ip = req.ip ?? "unknown";
  const quotaAllowed = await checkAndIncrementQuota(`create:${ip}`, CREATE_LIMIT, CREATE_WINDOW_MS);
  if (!quotaAllowed) {
    res.status(429).json({ error: `Rate limit exceeded: at most ${CREATE_LIMIT} analyses per 10 minutes per IP.` });
    return;
  }

  const rebuttalLens = requestedLens || parentRow.lens;

  const topFindings = (parentRow.findings as Array<{ title: string; severity: string; description: string }> | null)
    ?.slice(0, 5)
    .map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`)
    .join("\n") ?? "None";

  const docExcerpt =
    parentRow.documentText.length > 2000
      ? parentRow.documentText.substring(0, 2000) + "…[truncated]"
      : parentRow.documentText;

  const rebuttalSystemPrompt = `${BASE}

REBUTTAL ANALYSIS MODE — You are evaluating a response or rebuttal to a prior document analysis. Rigorously assess whether the rebuttal successfully addresses the original findings, identify new issues the rebuttal itself raises, and provide a balanced but critical analytical verdict.`;

  const userPrompt = `A previous analysis of the document titled "${parentRow.title}" (using the ${parentRow.lens} lens) produced the following:

ORIGINAL EXECUTIVE SUMMARY:
${parentRow.executiveSummary}

KEY FINDINGS FROM ORIGINAL ANALYSIS:
${topFindings}

The subject of that analysis has submitted the following REBUTTAL:
---
${rebuttalText}
---

ORIGINAL DOCUMENT (excerpt for context):
---
${docExcerpt}
---

Analyse the rebuttal rigorously. Evaluate: does it successfully address the original findings? Are counterarguments valid and evidence-backed? What residual vulnerabilities remain? Does the rebuttal introduce any new issues?

Return a structured JSON object with this exact schema:
{
  "overallScore": <number 0-100, higher = rebuttal is more persuasive>,
  "confidenceLevel": "High" | "Medium" | "Low",
  "executiveSummary": "<2-4 sentence verdict on the rebuttal's persuasiveness>",
  "sections": [
    { "title": "<section title>", "content": "<analysis>", "score": <number|null>, "findings": [] }
  ],
  "findings": [
    { "severity": "critical"|"high"|"medium"|"low"|"info", "category": "<category>", "title": "<title>", "description": "<detail>", "evidence": "<quote or null>", "recommendation": "<action or null>" }
  ],
  "citations": [],
  "recommendations": ["<actionable string>"]
}

Sections to cover: Rebuttal Effectiveness, Evidence Quality, Residual Vulnerabilities, New Issues Raised, Overall Verdict.

Return ONLY the JSON object, no other text.`;

  let rawContent = "";
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 5000,
      messages: [
        { role: "system", content: rebuttalSystemPrompt },
        { role: "user", content: userPrompt },
      ],
    });
    rawContent = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    req.log.error({ err }, "OpenAI rebuttal request failed");
    res.status(500).json({ error: "AI analysis failed" });
    return;
  }

  let analysisData: {
    overallScore?: number;
    confidenceLevel?: string;
    executiveSummary?: string;
    sections?: unknown[];
    findings?: unknown[];
    citations?: unknown[];
    recommendations?: unknown[];
  };
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found");
    analysisData = JSON.parse(jsonMatch[0]) as typeof analysisData;
  } catch {
    req.log.error({ rawContent }, "Failed to parse AI rebuttal response");
    analysisData = {
      overallScore: 50,
      executiveSummary: "Rebuttal analysis completed.",
      sections: [{ title: "Rebuttal Analysis", content: rawContent, score: null, findings: [] }],
      findings: [],
      citations: [],
      recommendations: [],
    };
  }

  const wc = countWords(rebuttalText);
  const cc = countChars(rebuttalText);
  const rebuttalTitle = `Rebuttal: ${parentRow.title}`;

  const [inserted] = await db
    .insert(analyses)
    .values({
      title: rebuttalTitle,
      lens: rebuttalLens,
      documentText: rebuttalText,
      wordCount: wc,
      charCount: cc,
      overallScore: typeof analysisData.overallScore === "number" ? analysisData.overallScore : 50,
      confidenceLevel: typeof analysisData.confidenceLevel === "string" ? analysisData.confidenceLevel : null,
      executiveSummary: typeof analysisData.executiveSummary === "string" ? analysisData.executiveSummary : "",
      sections: (analysisData.sections as object[]) ?? [],
      findings: (analysisData.findings as object[]) ?? [],
      citations: (analysisData.citations as object[]) ?? [],
      recommendations: (analysisData.recommendations as string[]) ?? [],
      clientToken: token,
      parentAnalysisId: parentRow.id,
      rebuttalText,
    })
    .returning();

  const findingsArr = (inserted.findings as Array<{ severity: string }>) ?? [];
  res.status(201).json({
    id: inserted.id,
    title: inserted.title,
    lens: inserted.lens,
    createdAt: inserted.createdAt,
    wordCount: inserted.wordCount,
    charCount: inserted.charCount,
    overallScore: inserted.overallScore,
    confidenceLevel: inserted.confidenceLevel,
    executiveSummary: inserted.executiveSummary,
    sections: inserted.sections,
    findings: inserted.findings,
    citations: inserted.citations,
    recommendations: inserted.recommendations,
    documentText: inserted.documentText,
    parentAnalysisId: inserted.parentAnalysisId ?? null,
    findingsCounts: {
      critical: findingsArr.filter((f) => f.severity === "critical").length,
      high: findingsArr.filter((f) => f.severity === "high").length,
      medium: findingsArr.filter((f) => f.severity === "medium").length,
      low: findingsArr.filter((f) => f.severity === "low").length,
    },
  });
});

export default router;
