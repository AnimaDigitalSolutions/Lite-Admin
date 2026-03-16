'use client';

import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowDownTrayIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { InvoicePDF, type InvoiceData } from '@/components/invoice-pdf-template';

/** Live preview card used in the edit sidebar */
export default function InvoicePDFPreview({ data, onDisable }: { data: InvoiceData; onDisable?: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Live Preview</CardTitle>
          <div className="flex items-center gap-1.5">
            {onDisable && (
              <Button variant="ghost" size="sm" onClick={onDisable} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <EyeSlashIcon className="h-3.5 w-3.5" />
                Hide
              </Button>
            )}
            <PDFDownloadLink
              document={<InvoicePDF data={data} />}
              fileName={`${data.invoice_number || 'invoice'}.pdf`}
            >
              {({ loading: pdfLoading }) => (
                <Button variant="outline" size="sm" disabled={pdfLoading} className="flex items-center gap-1">
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  {pdfLoading ? '...' : 'PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-hidden bg-muted" style={{ height: 680 }}>
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
          {pdfLoading ? 'Generating...' : 'Download PDF'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}

/** Full-page PDF viewer */
export function PDFFullViewer({ data }: { data: InvoiceData }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border overflow-hidden" style={{ height: 'calc(100vh - 160px)' }}>
      <PDFViewer width="100%" height="100%" showToolbar={false}>
        <InvoicePDF data={data} />
      </PDFViewer>
    </div>
  );
}
