import { Router } from "express";
import multer from "multer";

const router = Router();

// Keep files in memory — no disk writes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

const PLAIN_TEXT_EXTS = new Set([
  "txt", "md", "mdx", "markdown", "csv", "tsv",
  "json", "jsonl", "ndjson",
  "yaml", "yml",
  "toml", "ini", "env",
  "xml", "html", "htm", "xhtml", "svg",
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "rb", "rs", "go", "java", "c", "cpp", "cc", "h", "hpp",
  "cs", "swift", "kt", "kts", "scala", "php", "sh", "bash", "zsh",
  "sql", "graphql", "gql", "tf", "hcl", "dockerfile", "makefile",
  "r", "m", "pl", "lua", "ex", "exs", "clj", "erl", "elm",
  "vue", "svelte", "astro",
  "log", "rtf",
]);

router.post("/parse-document", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded." });
    return;
  }

  const { originalname, mimetype, buffer } = req.file;
  const ext = (originalname.split(".").pop() ?? "").toLowerCase();

  try {
    let text = "";

    if (mimetype === "application/pdf" || ext === "pdf") {
      // pdf-parse v2 uses a class-based API
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      text = result.text;
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (
      mimetype === "application/msword" ||
      ext === "doc"
    ) {
      // Legacy .doc — best-effort UTF-8 decode
      text = buffer.toString("utf-8").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, " ");
    } else if (PLAIN_TEXT_EXTS.has(ext) || mimetype.startsWith("text/")) {
      text = buffer.toString("utf-8");
    } else {
      // Unknown — attempt UTF-8, strip null bytes
      text = buffer.toString("utf-8").replace(/\x00/g, "");
    }

    text = text.trim();
    if (!text) {
      res.status(422).json({ error: "No readable text could be extracted from this file." });
      return;
    }

    res.json({ text, filename: originalname, chars: [...text].length });
  } catch (err) {
    req.log.error({ err }, "parse-document failed");
    res.status(500).json({ error: "Failed to extract text from file. The file may be corrupt or password-protected." });
  }
});

export default router;
