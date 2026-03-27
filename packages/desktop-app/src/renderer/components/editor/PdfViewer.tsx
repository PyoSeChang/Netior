import React, { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  absolutePath: string;
}

export function PdfViewer({ absolutePath }: PdfViewerProps): JSX.Element {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [error, setError] = useState<string | null>(null);

  const fileUrl = `file:///${absolutePath.replace(/\\/g, '/')}`;

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setPageNumber(1);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
  }, []);

  const goToPrev = useCallback(() => {
    setPageNumber((p) => Math.max(1, p - 1));
  }, []);

  const goToNext = useCallback(() => {
    setPageNumber((p) => Math.min(numPages, p + 1));
  }, [numPages]);

  const zoomIn = useCallback(() => {
    setScale((s) => Math.min(3.0, s + 0.25));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((s) => Math.max(0.25, s - 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1.0);
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted">
        Failed to load PDF: {error}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-subtle bg-surface-panel px-2 py-1">
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default disabled:opacity-30"
            onClick={goToPrev}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-secondary">
            <input
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v >= 1 && v <= numPages) setPageNumber(v);
              }}
              className="w-8 rounded border border-subtle bg-surface-base px-1 text-center text-xs text-default"
            />
            {' / '}{numPages}
          </span>
          <button
            className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default disabled:opacity-30"
            onClick={goToNext}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default"
            onClick={zoomOut}
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-secondary w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default"
            onClick={zoomIn}
          >
            <ZoomIn size={14} />
          </button>
          <button
            className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default"
            onClick={resetZoom}
          >
            <Maximize size={14} />
          </button>
        </div>
      </div>

      {/* PDF content */}
      <div className="flex-1 overflow-auto bg-surface-base">
        <div className="flex justify-center p-4">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center py-8 text-xs text-muted">Loading PDF...</div>
            }
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
        </div>
      </div>
    </div>
  );
}
