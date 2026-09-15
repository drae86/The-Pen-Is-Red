import { pgTable, serial, text, timestamp, integer, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analyses = pgTable("analyses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  lens: text("lens").notNull(),
  documentText: text("document_text").notNull(),
  wordCount: integer("word_count").notNull().default(0),
  charCount: integer("char_count").notNull().default(0),
  overallScore: real("overall_score").notNull().default(0),
  confidenceLevel: text("confidence_level"),
  executiveSummary: text("executive_summary").notNull().default(""),
  sections: jsonb("sections").notNull().default([]),
  findings: jsonb("findings").notNull().default([]),
  citations: jsonb("citations").notNull().default([]),
  recommendations: jsonb("recommendations").notNull().default([]),
  cachedSolutions: jsonb("cached_solutions"),
  clientToken: text("client_token"),
  solutionsGeneratedAt: timestamp("solutions_generated_at", { withTimezone: true }),
  parentAnalysisId: integer("parent_analysis_id"),
  rebuttalText: text("rebuttal_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAnalysisSchema = createInsertSchema(analyses).omit({
  id: true,
  createdAt: true,
});

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
