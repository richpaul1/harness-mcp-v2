import * as z from "zod/v4";
import * as fs from "node:fs";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResult, errorResult } from "../utils/response-formatter.js";
import { markdownToPdf } from "../utils/markdown-to-pdf.js";

/**
 * MCP tool: convert a Markdown file (or raw Markdown text) to a PDF.
 *
 * - Reads from `input_path` (a .md file on disk), **or**
 * - Accepts raw Markdown via `markdown` (string).
 * - Writes the PDF to `output_path`.
 */
export function registerMarkdownToPdfTool(server: McpServer): void {
  server.registerTool(
    "markdown_to_pdf",
    {
      description:
        "Convert a Markdown file or raw Markdown text to a PDF document. " +
        "Provide either input_path (path to a .md file) or markdown (raw text). " +
        "The PDF is saved to output_path (defaults to the same location as input with .pdf extension).",
      inputSchema: {
        input_path: z
          .string()
          .describe(
            "Absolute or workspace-relative path to a Markdown file to convert (e.g. 'docs/report.md'). " +
            "Mutually exclusive with `markdown`.",
          )
          .optional(),
        markdown: z
          .string()
          .describe(
            "Raw Markdown text to convert. Use this when the content is not on disk. " +
            "Mutually exclusive with `input_path`.",
          )
          .optional(),
        output_path: z
          .string()
          .describe(
            "Absolute or workspace-relative path for the output PDF (e.g. 'triage/report.pdf'). " +
            "Defaults to the input_path with a .pdf extension, or 'output.pdf' when using raw markdown.",
          )
          .optional(),
        title: z
          .string()
          .describe("Title shown in PDF metadata and as a header on the first page.")
          .optional(),
        page_size: z
          .enum(["A4", "LETTER", "LEGAL"])
          .describe("Page size for the PDF. Defaults to A4.")
          .optional(),
      },
      annotations: {
        title: "Convert Markdown to PDF",
        readOnlyHint: false,
        openWorldHint: false,
      },
    },
    async (args) => {
      /* ---------- Resolve markdown content ---------- */
      let mdContent: string;
      let resolvedInputPath: string | undefined;

      if (args.input_path && args.markdown) {
        return errorResult("Provide either input_path or markdown, not both.");
      }

      if (args.input_path) {
        resolvedInputPath = path.isAbsolute(args.input_path)
          ? args.input_path
          : path.resolve(process.cwd(), args.input_path);
        if (!fs.existsSync(resolvedInputPath)) {
          return errorResult(`File not found: ${resolvedInputPath}`);
        }
        mdContent = fs.readFileSync(resolvedInputPath, "utf-8");
      } else if (args.markdown) {
        mdContent = args.markdown;
      } else {
        return errorResult("Provide either input_path (path to a .md file) or markdown (raw text).");
      }

      if (mdContent.trim().length === 0) {
        return errorResult("Markdown content is empty.");
      }

      /* ---------- Resolve output path ---------- */
      let outPath: string;
      if (args.output_path) {
        outPath = path.isAbsolute(args.output_path)
          ? args.output_path
          : path.resolve(process.cwd(), args.output_path);
      } else if (resolvedInputPath) {
        outPath = resolvedInputPath.replace(/\.md$/i, ".pdf");
      } else {
        outPath = path.resolve(process.cwd(), "output.pdf");
      }

      /* ---------- Convert ---------- */
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await markdownToPdf(mdContent, {
          title: args.title,
          pageSize: args.page_size as "A4" | "LETTER" | "LEGAL" | undefined,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return errorResult(`PDF generation failed: ${msg}`);
      }

      /* ---------- Write ---------- */
      try {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, pdfBuffer);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return errorResult(`Failed to write PDF: ${msg}`);
      }

      return jsonResult({
        ok: true,
        output_path: outPath,
        size_bytes: pdfBuffer.length,
        page_size: args.page_size ?? "A4",
        title: args.title ?? null,
        source: resolvedInputPath ? "file" : "inline",
      });
    },
  );
}
