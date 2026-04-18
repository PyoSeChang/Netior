if (typeof URL.parse !== 'function') {
  (URL as unknown as Record<string, unknown>).parse = function (url: string, base?: string) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

const workerModulePath = 'pdfjs-dist/build/pdf.worker.min.mjs';
await import(workerModulePath);

export {};
