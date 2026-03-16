'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

interface PdfThumbnailProps {
  url: string;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsPromise: Promise<any> | null = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(/* webpackIgnore: true */ PDFJS_CDN).then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;
      return mod;
    });
  }
  return pdfjsPromise;
}

export default function PdfThumbnail({ url, className }: PdfThumbnailProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjs = await loadPdfjs();
        const pdf = await pdfjs.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const scale = Math.min(400 / viewport.width, 400 / viewport.height);
        const scaledViewport = page.getViewport({ scale });

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const ctx = canvas.getContext('2d');
        if (!ctx || cancelled) return;

        await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        if (!cancelled) {
          setSrc(canvas.toDataURL());
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void render();
    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className ?? ''}`}>
        <FileText className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="PDF preview" className={`object-cover ${className ?? ''}`} />
      ) : (
        <div className={`flex items-center justify-center bg-gray-100 ${className ?? ''}`}>
          <FileText className="h-12 w-12 text-gray-400 animate-pulse" />
        </div>
      )}
    </>
  );
}
