import './pdf-polyfill';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, BookOpen, File } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import type { PdfToc } from '@netior/shared/types';
import { fsService, fileService } from '../../services';
import { useI18n } from '../../hooks/useI18n';
import { useViewState } from '../../hooks/useViewState';
import { Tooltip } from '../ui/Tooltip';
import { PdfTocSidebar } from './pdf/PdfTocSidebar';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_OPTIONS = {
  wasmUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/wasm/`,
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
} as const;

type ViewMode = 'single' | 'dual';

interface PdfViewState {
  page: number;
  scale: number | 'fit-width';
  viewMode: ViewMode;
}

interface PdfViewerProps {
  tabId: string;
  absolutePath: string;
  fileId?: string;
}

export function PdfViewer({ tabId, absolutePath, fileId }: PdfViewerProps): JSX.Element {
  const { t } = useI18n();
  const [viewState, setViewState] = useViewState<PdfViewState>(tabId, { page: 1, scale: 'fit-width', viewMode: 'single' });
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(viewState.page);
  const [scale, setScale] = useState(viewState.scale === 'fit-width' ? 1.0 : viewState.scale);
  const [isFitWidth, setIsFitWidth] = useState(viewState.scale === 'fit-width');
  const [viewMode, setViewMode] = useState<ViewMode>(viewState.viewMode);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfToc, setPdfToc] = useState<PdfToc | null>(null);
  const [tocPinned, setTocPinned] = useState(false);
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const urlRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metaLoadedRef = useRef(false);
  const fileMetaRef = useRef<Record<string, unknown>>({});

  // Sync local state → viewState cache
  const syncViewState = useCallback((patch: Partial<PdfViewState>) => {
    setViewState((prev) => ({ ...prev, ...patch }));
  }, [setViewState]);

  const computeFitScale = useCallback((mode: ViewMode) => {
    if (!containerRef.current || !pageWidth) return 1.0;
    const available = containerRef.current.clientWidth - 32;
    if (mode === 'dual') {
      return Math.min(3.0, (available - 16) / (2 * pageWidth));
    }
    return Math.min(3.0, available / pageWidth);
  }, [pageWidth]);

  useEffect(() => {
    if (!isFitWidth || !pageWidth) return;
    setScale(computeFitScale(viewMode));
  }, [isFitWidth, pageWidth, viewMode, computeFitScale]);

  useEffect(() => {
    if (!isFitWidth) return;
    const handleResize = () => setScale(computeFitScale(viewMode));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFitWidth, viewMode, computeFitScale]);

  // Debounced persist to file metadata
  const persistToMetadata = useCallback((prefs: PdfViewState) => {
    if (!fileId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const entity = await fileService.get(fileId);
        const meta = entity?.metadata ? JSON.parse(entity.metadata) : {};
        meta.pdf_view = prefs;
        fileMetaRef.current = meta;
        await fileService.update(fileId, { metadata: JSON.stringify(meta) });
      } catch { /* ignore */ }
    }, 500);
  }, [fileId]);

  // Load PDF blob
  useEffect(() => {
    let cancelled = false;
    setNumPages(0);
    setError(null);
    setBlobUrl(null);
    setPageWidth(null);
    metaLoadedRef.current = false;

    (async () => {
      try {
        const buffer = await fsService.readBinaryFile(absolutePath);
        if (cancelled) return;
        const blob = new Blob([buffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = url;
        setBlobUrl(url);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [absolutePath]);

  // Load TOC + metadata fallback for prefs (only if viewState has defaults)
  useEffect(() => {
    if (!fileId) { setPdfToc(null); return; }
    let cancelled = false;
    setPdfToc(null);

    (async () => {
      try {
        const entity = await fileService.get(fileId);
        if (cancelled || !entity?.metadata) return;
        const meta = JSON.parse(entity.metadata);
        fileMetaRef.current = meta;

        if (meta.pdf_toc && Array.isArray(meta.pdf_toc.entries)) {
          setPdfToc(meta.pdf_toc as PdfToc);
        }

        // Restore from metadata only if viewState is at defaults (fresh open, not tab switch)
        if (!metaLoadedRef.current && meta.pdf_view && viewState.page === 1 && viewState.scale === 'fit-width') {
          const prefs = meta.pdf_view as PdfViewState;
          if (prefs.page && prefs.page > 1) { setPageNumber(prefs.page); syncViewState({ page: prefs.page }); }
          if (prefs.viewMode) { setViewMode(prefs.viewMode); syncViewState({ viewMode: prefs.viewMode }); }
          if (prefs.scale === 'fit-width') {
            setIsFitWidth(true);
          } else if (typeof prefs.scale === 'number') {
            setIsFitWidth(false);
            setScale(prefs.scale);
            syncViewState({ scale: prefs.scale });
          }
          metaLoadedRef.current = true;
        }
      } catch { /* ignore */ }
    })();

    return () => { cancelled = true; };
  }, [fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    // Don't reset page — keep from viewState/metadata
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => { setError(err.message); }, []);

  const setPage = useCallback((page: number) => {
    setPageNumber(page);
    syncViewState({ page });
    persistToMetadata({ page, scale: isFitWidth ? 'fit-width' : scale, viewMode });
  }, [syncViewState, persistToMetadata, isFitWidth, scale, viewMode]);

  const goToPrev = useCallback(() => {
    setPageNumber((p) => {
      const next = Math.max(1, p - (viewMode === 'dual' ? 2 : 1));
      syncViewState({ page: next });
      persistToMetadata({ page: next, scale: isFitWidth ? 'fit-width' : scale, viewMode });
      return next;
    });
  }, [viewMode, syncViewState, persistToMetadata, isFitWidth, scale]);

  const goToNext = useCallback(() => {
    setPageNumber((p) => {
      const next = Math.min(numPages, p + (viewMode === 'dual' ? 2 : 1));
      syncViewState({ page: next });
      persistToMetadata({ page: next, scale: isFitWidth ? 'fit-width' : scale, viewMode });
      return next;
    });
  }, [numPages, viewMode, syncViewState, persistToMetadata, isFitWidth, scale]);

  const zoomIn = useCallback(() => {
    setIsFitWidth(false);
    setScale((s) => {
      const n = Math.min(3.0, s + 0.25);
      syncViewState({ scale: n });
      persistToMetadata({ page: pageNumber, scale: n, viewMode });
      return n;
    });
  }, [syncViewState, persistToMetadata, pageNumber, viewMode]);

  const zoomOut = useCallback(() => {
    setIsFitWidth(false);
    setScale((s) => {
      const n = Math.max(0.25, s - 0.25);
      syncViewState({ scale: n });
      persistToMetadata({ page: pageNumber, scale: n, viewMode });
      return n;
    });
  }, [syncViewState, persistToMetadata, pageNumber, viewMode]);

  const resetToFitWidth = useCallback(() => {
    setIsFitWidth(true);
    setScale(computeFitScale(viewMode));
    syncViewState({ scale: 'fit-width' });
    persistToMetadata({ page: pageNumber, scale: 'fit-width', viewMode });
  }, [computeFitScale, viewMode, syncViewState, persistToMetadata, pageNumber]);

  const handlePageJump = useCallback((destPage: number) => {
    const clamped = Math.max(1, Math.min(numPages || destPage, destPage));
    setPage(clamped);
  }, [numPages, setPage]);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === 'single' ? 'dual' : 'single';
      if (isFitWidth) setScale(computeFitScale(next));
      syncViewState({ viewMode: next });
      persistToMetadata({ page: pageNumber, scale: isFitWidth ? 'fit-width' : scale, viewMode: next });
      return next;
    });
  }, [isFitWidth, scale, computeFitScale, syncViewState, persistToMetadata, pageNumber]);

  const handlePageLoadSuccess = useCallback((page: { originalWidth: number }) => {
    if (!pageWidth) setPageWidth(page.originalWidth);
  }, [pageWidth]);

  const pagesToRender = useMemo(() => {
    if (viewMode === 'single') return [pageNumber];
    if (pageNumber === 1) return [1];
    const leftPage = pageNumber % 2 === 0 ? pageNumber : pageNumber - 1;
    const rightPage = leftPage + 1;
    if (rightPage > numPages) return [leftPage];
    return [leftPage, rightPage];
  }, [viewMode, pageNumber, numPages]);

  if (error) {
    return <div className="flex h-full items-center justify-center text-xs text-muted">Failed to load PDF: {error}</div>;
  }
  if (!blobUrl) {
    return <div className="flex h-full items-center justify-center text-xs text-muted">Loading PDF...</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between bg-surface-panel px-2 py-1">
        <div className="flex items-center gap-1">
          <button className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default disabled:opacity-30" onClick={goToPrev} disabled={pageNumber <= 1}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-secondary">
            <input
              type="number" min={1} max={numPages} value={pageNumber}
              onChange={(e) => { const v = parseInt(e.target.value, 10); if (v >= 1 && v <= numPages) setPage(v); }}
              className="w-12 rounded border border-subtle bg-surface-base px-1 text-center text-xs text-default"
            />
            {' / '}{numPages}
          </span>
          <button className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default disabled:opacity-30" onClick={goToNext} disabled={pageNumber >= numPages}>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip content={viewMode === 'single' ? t('pdfViewer.dualView') : t('pdfViewer.singleView')}>
            <button className={`rounded p-1 hover:bg-surface-hover ${viewMode === 'dual' ? 'text-accent' : 'text-muted hover:text-default'}`} onClick={toggleViewMode}>
              {viewMode === 'single' ? <BookOpen size={14} /> : <File size={14} />}
            </button>
          </Tooltip>
          <button className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default" onClick={zoomOut}><ZoomOut size={14} /></button>
          <span className="text-xs text-secondary w-12 text-center">{Math.round(scale * 100)}%</span>
          <button className="rounded p-1 text-muted hover:bg-surface-hover hover:text-default" onClick={zoomIn}><ZoomIn size={14} /></button>
          <Tooltip content={t('pdfViewer.fitWidth')}>
            <button className={`rounded p-1 hover:bg-surface-hover ${isFitWidth ? 'text-accent' : 'text-muted hover:text-default'}`} onClick={resetToFitWidth}>
              <Maximize size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <PdfTocSidebar toc={pdfToc} currentPage={pageNumber} pinned={tocPinned} onPinChange={setTocPinned} onPageJump={handlePageJump} />

        <div ref={containerRef} className="h-full overflow-auto bg-surface-panel">
          <div className="flex justify-center p-4">
            <Document file={blobUrl} onLoadSuccess={onDocumentLoadSuccess} onLoadError={onDocumentLoadError} options={PDF_OPTIONS}
              loading={<div className="flex items-center justify-center py-8 text-xs text-muted">Loading PDF...</div>}
            >
              <div className={`flex ${viewMode === 'dual' ? 'flex-row gap-4' : 'flex-col'}`}>
                {pagesToRender.map((pn) => (
                  <Page key={pn} pageNumber={pn} scale={scale} renderTextLayer={true} renderAnnotationLayer={true} onLoadSuccess={handlePageLoadSuccess} />
                ))}
              </div>
            </Document>
          </div>
        </div>
      </div>
    </div>
  );
}
