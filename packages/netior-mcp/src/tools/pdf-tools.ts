import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getFileEntity, updateFileMetadataField } from '../netior-service-client.js';
import { validateProjectRootPath } from './path-validation.js';
import { emitChange } from '../events.js';

async function extractTextFromPage(pdfDoc: unknown, pageNum: number): Promise<string> {
  // pdfjs-dist types are complex; use dynamic typing here
  const doc = pdfDoc as { getPage(n: number): Promise<{ getTextContent(): Promise<{ items: Array<{ str?: string }> }> }> };
  const page = await doc.getPage(pageNum);
  const content = await page.getTextContent();
  return content.items
    .map((item) => item.str ?? '')
    .join('');
}

export function registerPdfTools(server: McpServer): void {
  // -- read_pdf_pages --------------------------------------------------
  server.tool(
    'read_pdf_pages',
    'Extract text from specified page range of a PDF file. Use this to read TOC pages for indexing.',
    {
      project_id: z.string().describe('The project ID'),
      file_path: z.string().describe('Absolute path to the PDF file'),
      start_page: z.number().int().min(1).describe('First page to read (1-based)'),
      end_page: z.number().int().min(1).describe('Last page to read (1-based, inclusive)'),
    },
    async ({ project_id, file_path, start_page, end_page }) => {
      try {
        const validationError = await validateProjectRootPath(project_id, file_path);
        if (validationError) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${validationError}` }],
            isError: true,
          };
        }

        if (end_page < start_page) {
          return {
            content: [{ type: 'text' as const, text: 'Error: end_page must be >= start_page' }],
            isError: true,
          };
        }

        // Dynamic import for pdfjs-dist (ESM)
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

        const data = new Uint8Array(
          (await import('fs')).readFileSync(file_path)
        );
        const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true });
        const pdfDoc = await loadingTask.promise;
        const totalPages = pdfDoc.numPages;

        if (start_page > totalPages || end_page > totalPages) {
          return {
            content: [{ type: 'text' as const, text: `Error: PDF has ${totalPages} pages. Requested range ${start_page}-${end_page} is out of bounds.` }],
            isError: true,
          };
        }

        const pages: Array<{ page: number; text: string }> = [];
        for (let i = start_page; i <= end_page; i++) {
          const text = await extractTextFromPage(pdfDoc, i);
          pages.push({ page: i, text });
        }

        const result = { pages, totalPages };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // -- read_pdf_pages_vision ----------------------------------------
  server.tool(
    'read_pdf_pages_vision',
    '[Experimental -- requires optional "canvas" npm package] Render PDF pages as images for vision-based TOC extraction. Will error if canvas is not installed. Not used by default prompts.',
    {
      project_id: z.string().describe('The project ID'),
      file_path: z.string().describe('Absolute path to the PDF file'),
      start_page: z.number().int().min(1).describe('First page to render (1-based)'),
      end_page: z.number().int().min(1).describe('Last page to render (1-based, inclusive)'),
    },
    async ({ project_id, file_path, start_page, end_page }) => {
      try {
        const validationError = await validateProjectRootPath(project_id, file_path);
        if (validationError) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${validationError}` }],
            isError: true,
          };
        }

        if (end_page < start_page) {
          return {
            content: [{ type: 'text' as const, text: 'Error: end_page must be >= start_page' }],
            isError: true,
          };
        }

        // Try to load canvas for PDF rendering (optional peer dependency)
        let createCanvas: (w: number, h: number) => unknown;
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const canvasModule = await (Function('return import("canvas")')() as Promise<{ createCanvas: (w: number, h: number) => unknown }>);
          createCanvas = canvasModule.createCanvas;
        } catch {
          return {
            content: [{ type: 'text' as const, text: 'Error: Vision fallback requires the "canvas" npm package. Install it with: pnpm --filter @netior/mcp add canvas' }],
            isError: true,
          };
        }

        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const data = new Uint8Array(
          (await import('fs')).readFileSync(file_path)
        );
        const loadingTask = pdfjsLib.getDocument({ data, useSystemFonts: true });
        const pdfDoc = await loadingTask.promise;
        const totalPages = pdfDoc.numPages;

        if (start_page > totalPages || end_page > totalPages) {
          return {
            content: [{ type: 'text' as const, text: `Error: PDF has ${totalPages} pages. Requested range ${start_page}-${end_page} is out of bounds.` }],
            isError: true,
          };
        }

        // Render each page to an image at 150 DPI
        const DPI = 150;
        const SCALE = DPI / 72; // PDF default is 72 DPI
        const contentBlocks: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [];

        for (let i = start_page; i <= end_page; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: SCALE });
          const canvas = createCanvas(viewport.width, viewport.height) as {
            getContext(type: string): unknown;
            toBuffer(mime: string): Buffer;
          };
          const context = canvas.getContext('2d');

          await page.render({ canvasContext: context, viewport } as never).promise;

          const pngBuffer = canvas.toBuffer('image/png');
          const base64 = pngBuffer.toString('base64');

          contentBlocks.push({ type: 'text' as const, text: `--- Page ${i} ---` });
          contentBlocks.push({ type: 'image' as const, data: base64, mimeType: 'image/png' });
        }

        contentBlocks.push({ type: 'text' as const, text: `Total pages in PDF: ${totalPages}` });

        return { content: contentBlocks };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // -- get_file_metadata --------------------------------------------
  server.tool(
    'get_file_metadata',
    'Get a file entity and its metadata from the database. Use this to check if a PDF already has a TOC.',
    {
      file_id: z.string().describe('The file entity ID'),
    },
    async ({ file_id }) => {
      try {
        const entity = await getFileEntity(file_id);
        if (!entity) {
          return {
            content: [{ type: 'text' as const, text: `Error: File entity not found: ${file_id}` }],
            isError: true,
          };
        }

        const metadata = entity.metadata ? JSON.parse(entity.metadata) : null;
        const result = {
          id: entity.id,
          project_id: entity.project_id,
          path: entity.path,
          type: entity.type,
          metadata,
          created_at: entity.created_at,
          updated_at: entity.updated_at,
        };
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // -- update_file_pdf_toc ------------------------------------------
  server.tool(
    'update_file_pdf_toc',
    'Save or update the PDF table of contents for a file entity. Only call this after the user has approved the TOC.',
    {
      file_id: z.string().describe('The file entity ID'),
      pdf_toc: z.object({
        entries: z.array(z.object({
          id: z.string().describe('Unique entry identifier'),
          title: z.string().describe('TOC entry title'),
          destPage: z.number().int().min(1).describe('Physical PDF page number for viewer jump'),
          level: z.number().int().min(0).describe('Hierarchy level (0 = top)'),
        })),
        pageCount: z.number().int().min(1).describe('Total pages in the PDF'),
        analyzedAt: z.string().describe('ISO 8601 timestamp of analysis'),
        sourceMethod: z.enum(['text', 'vision']).describe('Extraction method used'),
      }).describe('The complete PDF TOC structure'),
    },
    async ({ file_id, pdf_toc }) => {
      try {
        const updated = await updateFileMetadataField(file_id, 'pdf_toc', pdf_toc);
        if (!updated) {
          return {
            content: [{ type: 'text' as const, text: `Error: File entity not found: ${file_id}` }],
            isError: true,
          };
        }

        emitChange({ type: 'file', action: 'update', id: file_id });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, file_id, entries_count: pdf_toc.entries.length }) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );
}
