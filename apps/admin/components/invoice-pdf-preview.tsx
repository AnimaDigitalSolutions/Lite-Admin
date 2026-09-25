"use client";

import { useEffect, useState } from "react";
import { BlobProvider, PDFDownloadLink, PDFViewer } from "@react-pdf/renderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  DocumentTextIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import {
  InvoicePDF,
  type InvoiceData,
} from "@/components/invoice-pdf-template";

/** Live preview card used in the edit sidebar */
export default function InvoicePDFPreview({
  data,
  onDisable,
}: {
  data: InvoiceData;
  onDisable?: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Live Preview</CardTitle>
          <div className="flex items-center gap-1.5">
            {onDisable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDisable}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <EyeSlashIcon className="h-3.5 w-3.5" />
                Hide
              </Button>
            )}
            <PDFDownloadLink
              document={<InvoicePDF data={data} />}
              fileName={`${data.invoice_number || "invoice"}.pdf`}
            >
              {({ loading: pdfLoading }) => (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pdfLoading}
                  className="flex items-center gap-1"
                >
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  {pdfLoading ? "..." : "PDF"}
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="border rounded-lg overflow-hidden bg-muted"
          style={{ height: 680 }}
        >
          <PDFViewer width="100%" height="100%" showToolbar={false}>
            <InvoicePDF data={data} />
          </PDFViewer>
        </div>
      </CardContent>
    </Card>
  );
}

/** Download button for the preview page */
export function PDFDownloadButton({ data }: { data: InvoiceData }) {
  return (
    <PDFDownloadLink
      document={<InvoicePDF data={data} />}
      fileName={`${data.invoice_number}.pdf`}
    >
      {({ loading: pdfLoading }) => (
        <Button disabled={pdfLoading} className="flex items-center gap-2">
          <ArrowDownTrayIcon className="h-4 w-4" />
          {pdfLoading ? "Generating..." : "Download PDF"}
        </Button>
      )}
    </PDFDownloadLink>
  );
}

/**
 * Mobile browsers can't show a PDF inside an iframe (Android Chrome renders
 * nothing, iOS Safari only the first page), so touch devices get a link that
 * opens the PDF in the device's own viewer instead.
 */
function useInlinePdfSupported() {
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const hasViewer =
      (navigator as Navigator & { pdfViewerEnabled?: boolean })
        .pdfViewerEnabled !== false;
    setSupported(hasViewer && !coarse);
  }, []);
  return supported;
}

/** Full-page PDF viewer */
export function PDFFullViewer({ data }: { data: InvoiceData }) {
  const inlineSupported = useInlinePdfSupported();

  if (!inlineSupported) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <DocumentTextIcon className="h-12 w-12 text-muted-foreground/50" />
          <p className="max-w-xs text-sm text-muted-foreground">
            Your device can&apos;t show the PDF inline. Open it in your PDF
            viewer or download it.
          </p>
          <BlobProvider document={<InvoicePDF data={data} />}>
            {({ url, loading }) => (
              <Button
                asChild={!!url && !loading}
                variant="outline"
                disabled={loading || !url}
                className="flex items-center gap-2"
              >
                {url && !loading ? (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    Open PDF
                  </a>
                ) : (
                  <span>Generating...</span>
                )}
              </Button>
            )}
          </BlobProvider>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="bg-white rounded-lg shadow-sm border overflow-hidden"
      style={{ height: "calc(100vh - 160px)" }}
    >
      <PDFViewer width="100%" height="100%" showToolbar={false}>
        <InvoicePDF data={data} />
      </PDFViewer>
    </div>
  );
}
