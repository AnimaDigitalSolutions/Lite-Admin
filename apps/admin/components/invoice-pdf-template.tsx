'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';

export interface InvoiceLineItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface InvoiceData {
  id?: number;
  invoice_number: string;
  status: string;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  notes?: string;
  due_date?: string;
  issued_date?: string;
  client_name?: string;
  client_email?: string;
  client_address?: string;
  company_name?: string;
  company_email?: string;
  company_address?: string;
  company_phone?: string;
  company_logo_url?: string;
  template: string;
  items: InvoiceLineItem[];
  created_at?: string;
  updated_at?: string;
}


const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5', CAD: 'CA$', AUD: 'A$',
  CHF: 'CHF', CNY: '\u00A5', INR: '\u20B9', BRL: 'R$',
};

function formatCurrency(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return `${symbol}${amount.toFixed(2)}`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Classic Template ────────────────────────────────────────────────────────

const classicStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  companyBlock: { maxWidth: '55%' },
  companyName: { fontSize: 18, fontWeight: 'bold', marginBottom: 4, color: '#111' },
  companyDetail: { fontSize: 9, color: '#555', marginBottom: 2 },
  invoiceBlock: { textAlign: 'right' },
  invoiceTitle: { fontSize: 22, fontWeight: 'bold', color: '#111', marginBottom: 8 },
  invoiceMeta: { fontSize: 9, color: '#555', marginBottom: 2 },
  invoiceNumber: { fontSize: 11, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e0e0e0', marginVertical: 16 },
  billedTo: { marginBottom: 24 },
  sectionLabel: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.2, color: '#888', marginBottom: 6 },
  clientName: { fontSize: 12, fontWeight: 'bold', marginBottom: 2 },
  clientDetail: { fontSize: 9, color: '#555', marginBottom: 2 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f7f7f7', borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 8, paddingHorizontal: 8 },
  tableHeaderText: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.8, color: '#666' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', paddingVertical: 8, paddingHorizontal: 8 },
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center' },
  colPrice: { flex: 1.5, textAlign: 'right' },
  colAmount: { flex: 1.5, textAlign: 'right' },
  totalsBlock: { marginTop: 16, alignItems: 'flex-end' },
  totalsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4, width: 220 },
  totalsLabel: { flex: 1, textAlign: 'right', paddingRight: 12, color: '#666' },
  totalsValue: { width: 90, textAlign: 'right' },
  totalFinal: { flexDirection: 'row', justifyContent: 'flex-end', width: 220, borderTopWidth: 2, borderTopColor: '#111', paddingTop: 6, marginTop: 4 },
  totalFinalLabel: { flex: 1, textAlign: 'right', paddingRight: 12, fontSize: 12, fontWeight: 'bold' },
  totalFinalValue: { width: 90, textAlign: 'right', fontSize: 12, fontWeight: 'bold' },
  notesSection: { marginTop: 30 },
  notesText: { fontSize: 9, color: '#555', lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#aaa' },
  statusBadge: { fontSize: 9, fontWeight: 'bold', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 3, marginTop: 4 },
});

function ClassicTemplate({ data }: { data: InvoiceData }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    draft: { bg: '#f3f4f6', text: '#6b7280' },
    sent: { bg: '#dbeafe', text: '#2563eb' },
    paid: { bg: '#dcfce7', text: '#16a34a' },
    overdue: { bg: '#fef2f2', text: '#dc2626' },
    cancelled: { bg: '#f3f4f6', text: '#9ca3af' },
  };
  const sc = statusColors[data.status] || statusColors.draft;

  return (
    <Document>
      <Page size="A4" style={classicStyles.page}>
        {/* Header */}
        <View style={classicStyles.header}>
          <View style={classicStyles.companyBlock}>
            {data.company_name && <Text style={classicStyles.companyName}>{data.company_name}</Text>}
            {data.company_address && <Text style={classicStyles.companyDetail}>{data.company_address}</Text>}
            {data.company_email && <Text style={classicStyles.companyDetail}>{data.company_email}</Text>}
            {data.company_phone && <Text style={classicStyles.companyDetail}>{data.company_phone}</Text>}
          </View>
          <View style={classicStyles.invoiceBlock}>
            <Text style={classicStyles.invoiceTitle}>INVOICE</Text>
            <Text style={classicStyles.invoiceNumber}>{data.invoice_number}</Text>
            <Text style={classicStyles.invoiceMeta}>Issued: {formatDate(data.issued_date)}</Text>
            <Text style={classicStyles.invoiceMeta}>Due: {formatDate(data.due_date)}</Text>
            <Text style={[classicStyles.statusBadge, { backgroundColor: sc.bg, color: sc.text }]}>
              {data.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={classicStyles.divider} />

        {/* Bill To */}
        <View style={classicStyles.billedTo}>
          <Text style={classicStyles.sectionLabel}>Bill To</Text>
          {data.client_name && <Text style={classicStyles.clientName}>{data.client_name}</Text>}
          {data.client_email && <Text style={classicStyles.clientDetail}>{data.client_email}</Text>}
          {data.client_address && <Text style={classicStyles.clientDetail}>{data.client_address}</Text>}
        </View>

        {/* Table */}
        <View style={classicStyles.tableHeader}>
          <Text style={[classicStyles.tableHeaderText, classicStyles.colDescription]}>Description</Text>
          <Text style={[classicStyles.tableHeaderText, classicStyles.colQty]}>Qty</Text>
          <Text style={[classicStyles.tableHeaderText, classicStyles.colPrice]}>Unit Price</Text>
          <Text style={[classicStyles.tableHeaderText, classicStyles.colAmount]}>Amount</Text>
        </View>
        {data.items.map((item, i) => (
          <View key={i} style={classicStyles.tableRow}>
            <Text style={classicStyles.colDescription}>{item.description}</Text>
            <Text style={classicStyles.colQty}>{item.quantity}</Text>
            <Text style={classicStyles.colPrice}>{formatCurrency(item.unit_price, data.currency)}</Text>
            <Text style={classicStyles.colAmount}>{formatCurrency(item.quantity * item.unit_price, data.currency)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={classicStyles.totalsBlock}>
          <View style={classicStyles.totalsRow}>
            <Text style={classicStyles.totalsLabel}>Subtotal</Text>
            <Text style={classicStyles.totalsValue}>{formatCurrency(data.subtotal, data.currency)}</Text>
          </View>
          {data.tax_rate > 0 && (
            <View style={classicStyles.totalsRow}>
              <Text style={classicStyles.totalsLabel}>Tax ({data.tax_rate}%)</Text>
              <Text style={classicStyles.totalsValue}>{formatCurrency(data.tax_amount, data.currency)}</Text>
            </View>
          )}
          {data.discount > 0 && (
            <View style={classicStyles.totalsRow}>
              <Text style={classicStyles.totalsLabel}>Discount</Text>
              <Text style={classicStyles.totalsValue}>-{formatCurrency(data.discount, data.currency)}</Text>
            </View>
          )}
          <View style={classicStyles.totalFinal}>
            <Text style={classicStyles.totalFinalLabel}>Total</Text>
            <Text style={classicStyles.totalFinalValue}>{formatCurrency(data.total, data.currency)}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={classicStyles.notesSection}>
            <Text style={classicStyles.sectionLabel}>Notes</Text>
            <Text style={classicStyles.notesText}>{data.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <Text style={classicStyles.footer}>
          {data.company_name ? `${data.company_name} — ` : ''}Thank you for your business.
        </Text>
      </Page>
    </Document>
  );
}

// ─── Modern Template ─────────────────────────────────────────────────────────

const modernStyles = StyleSheet.create({
  page: { padding: 0, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  accent: { backgroundColor: '#111827', height: 120, paddingHorizontal: 40, paddingTop: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  accentTitle: { fontSize: 28, fontWeight: 'bold', color: '#ffffff', letterSpacing: 2 },
  accentMeta: { textAlign: 'right' },
  accentText: { fontSize: 9, color: '#d1d5db', marginBottom: 2 },
  accentNumber: { fontSize: 13, fontWeight: 'bold', color: '#ffffff', marginBottom: 6 },
  body: { paddingHorizontal: 40, paddingTop: 24 },
  addressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  addressBlock: { maxWidth: '45%' },
  addressLabel: { fontSize: 7, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, color: '#9ca3af', marginBottom: 6 },
  addressName: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  addressLine: { fontSize: 9, color: '#6b7280', marginBottom: 1 },
  table: { marginBottom: 20 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f9fafb', borderBottomWidth: 2, borderBottomColor: '#111827', paddingVertical: 10, paddingHorizontal: 10 },
  tableHeaderText: { fontSize: 7, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, color: '#374151' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 10, paddingHorizontal: 10 },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#fafafa' },
  colDescription: { flex: 3 },
  colQty: { flex: 0.8, textAlign: 'center' },
  colPrice: { flex: 1.2, textAlign: 'right' },
  colAmount: { flex: 1.2, textAlign: 'right' },
  summaryBox: { alignItems: 'flex-end' },
  summaryRow: { flexDirection: 'row', width: 240, justifyContent: 'space-between', marginBottom: 5, paddingVertical: 2 },
  summaryLabel: { color: '#6b7280', fontSize: 10 },
  summaryValue: { fontSize: 10, fontWeight: 'bold' },
  totalRow: { flexDirection: 'row', width: 240, justifyContent: 'space-between', backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 4, marginTop: 4 },
  totalLabel: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  totalValue: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  notesSection: { marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  notesLabel: { fontSize: 7, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, color: '#9ca3af', marginBottom: 6 },
  notesText: { fontSize: 9, color: '#6b7280', lineHeight: 1.6 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#d1d5db' },
});

function ModernTemplate({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={modernStyles.page}>
        {/* Dark header band */}
        <View style={modernStyles.accent}>
          <Text style={modernStyles.accentTitle}>INVOICE</Text>
          <View style={modernStyles.accentMeta}>
            <Text style={modernStyles.accentNumber}>{data.invoice_number}</Text>
            <Text style={modernStyles.accentText}>Issued: {formatDate(data.issued_date)}</Text>
            <Text style={modernStyles.accentText}>Due: {formatDate(data.due_date)}</Text>
            <Text style={[modernStyles.accentText, { color: data.status === 'paid' ? '#86efac' : data.status === 'overdue' ? '#fca5a5' : '#d1d5db' }]}>
              {data.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={modernStyles.body}>
          {/* From / To */}
          <View style={modernStyles.addressRow}>
            <View style={modernStyles.addressBlock}>
              <Text style={modernStyles.addressLabel}>From</Text>
              {data.company_name && <Text style={modernStyles.addressName}>{data.company_name}</Text>}
              {data.company_address && <Text style={modernStyles.addressLine}>{data.company_address}</Text>}
              {data.company_email && <Text style={modernStyles.addressLine}>{data.company_email}</Text>}
              {data.company_phone && <Text style={modernStyles.addressLine}>{data.company_phone}</Text>}
            </View>
            <View style={modernStyles.addressBlock}>
              <Text style={modernStyles.addressLabel}>Bill To</Text>
              {data.client_name && <Text style={modernStyles.addressName}>{data.client_name}</Text>}
              {data.client_email && <Text style={modernStyles.addressLine}>{data.client_email}</Text>}
              {data.client_address && <Text style={modernStyles.addressLine}>{data.client_address}</Text>}
            </View>
          </View>

          {/* Items table */}
          <View style={modernStyles.table}>
            <View style={modernStyles.tableHeader}>
              <Text style={[modernStyles.tableHeaderText, modernStyles.colDescription]}>Description</Text>
              <Text style={[modernStyles.tableHeaderText, modernStyles.colQty]}>Qty</Text>
              <Text style={[modernStyles.tableHeaderText, modernStyles.colPrice]}>Price</Text>
              <Text style={[modernStyles.tableHeaderText, modernStyles.colAmount]}>Amount</Text>
            </View>
            {data.items.map((item, i) => (
              <View key={i} style={i % 2 === 1 ? modernStyles.tableRowAlt : modernStyles.tableRow}>
                <Text style={modernStyles.colDescription}>{item.description}</Text>
                <Text style={modernStyles.colQty}>{item.quantity}</Text>
                <Text style={modernStyles.colPrice}>{formatCurrency(item.unit_price, data.currency)}</Text>
                <Text style={modernStyles.colAmount}>{formatCurrency(item.quantity * item.unit_price, data.currency)}</Text>
              </View>
            ))}
          </View>

          {/* Summary */}
          <View style={modernStyles.summaryBox}>
            <View style={modernStyles.summaryRow}>
              <Text style={modernStyles.summaryLabel}>Subtotal</Text>
              <Text style={modernStyles.summaryValue}>{formatCurrency(data.subtotal, data.currency)}</Text>
            </View>
            {data.tax_rate > 0 && (
              <View style={modernStyles.summaryRow}>
                <Text style={modernStyles.summaryLabel}>Tax ({data.tax_rate}%)</Text>
                <Text style={modernStyles.summaryValue}>{formatCurrency(data.tax_amount, data.currency)}</Text>
              </View>
            )}
            {data.discount > 0 && (
              <View style={modernStyles.summaryRow}>
                <Text style={modernStyles.summaryLabel}>Discount</Text>
                <Text style={modernStyles.summaryValue}>-{formatCurrency(data.discount, data.currency)}</Text>
              </View>
            )}
            <View style={modernStyles.totalRow}>
              <Text style={modernStyles.totalLabel}>Total Due</Text>
              <Text style={modernStyles.totalValue}>{formatCurrency(data.total, data.currency)}</Text>
            </View>
          </View>

          {/* Notes */}
          {data.notes && (
            <View style={modernStyles.notesSection}>
              <Text style={modernStyles.notesLabel}>Notes</Text>
              <Text style={modernStyles.notesText}>{data.notes}</Text>
            </View>
          )}
        </View>

        <Text style={modernStyles.footer}>
          {data.company_name ? `${data.company_name} — ` : ''}Thank you for your business.
        </Text>
      </Page>
    </Document>
  );
}

// ─── Minimal Template ────────────────────────────────────────────────────────

const minimalStyles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: 'Helvetica', color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  title: { fontSize: 14, fontWeight: 'bold', letterSpacing: 4, textTransform: 'uppercase', color: '#000' },
  metaBlock: { textAlign: 'right' },
  metaLine: { fontSize: 9, color: '#888', marginBottom: 2 },
  metaNumber: { fontSize: 10, fontWeight: 'bold', color: '#000', marginBottom: 4 },
  addressRow: { flexDirection: 'row', gap: 40, marginBottom: 32 },
  addressBlock: { flex: 1 },
  addressLabel: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1.5, color: '#aaa', marginBottom: 6 },
  addressText: { fontSize: 9, color: '#555', marginBottom: 1 },
  addressName: { fontSize: 10, fontWeight: 'bold', color: '#000', marginBottom: 2 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 6, marginBottom: 0 },
  tableHeaderText: { fontSize: 8, textTransform: 'uppercase', letterSpacing: 1, color: '#888' },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center' },
  colPrice: { flex: 1.5, textAlign: 'right' },
  colAmount: { flex: 1.5, textAlign: 'right' },
  totalsBlock: { alignItems: 'flex-end', marginTop: 16 },
  totalsRow: { flexDirection: 'row', width: 200, justifyContent: 'space-between', marginBottom: 3 },
  totalsLabel: { color: '#888', fontSize: 9 },
  totalsValue: { fontSize: 9 },
  totalFinal: { flexDirection: 'row', width: 200, justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#000', paddingTop: 6, marginTop: 4 },
  totalLabel: { fontSize: 11, fontWeight: 'bold' },
  totalValue: { fontSize: 11, fontWeight: 'bold' },
  notes: { marginTop: 40, fontSize: 9, color: '#888', lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 30, left: 48, right: 48, textAlign: 'center', fontSize: 7, color: '#ccc', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
});

function MinimalTemplate({ data }: { data: InvoiceData }) {
  return (
    <Document>
      <Page size="A4" style={minimalStyles.page}>
        <View style={minimalStyles.header}>
          <Text style={minimalStyles.title}>Invoice</Text>
          <View style={minimalStyles.metaBlock}>
            <Text style={minimalStyles.metaNumber}>{data.invoice_number}</Text>
            <Text style={minimalStyles.metaLine}>{formatDate(data.issued_date)}</Text>
            {data.due_date && <Text style={minimalStyles.metaLine}>Due {formatDate(data.due_date)}</Text>}
          </View>
        </View>

        <View style={minimalStyles.addressRow}>
          <View style={minimalStyles.addressBlock}>
            <Text style={minimalStyles.addressLabel}>From</Text>
            {data.company_name && <Text style={minimalStyles.addressName}>{data.company_name}</Text>}
            {data.company_address && <Text style={minimalStyles.addressText}>{data.company_address}</Text>}
            {data.company_email && <Text style={minimalStyles.addressText}>{data.company_email}</Text>}
            {data.company_phone && <Text style={minimalStyles.addressText}>{data.company_phone}</Text>}
          </View>
          <View style={minimalStyles.addressBlock}>
            <Text style={minimalStyles.addressLabel}>To</Text>
            {data.client_name && <Text style={minimalStyles.addressName}>{data.client_name}</Text>}
            {data.client_email && <Text style={minimalStyles.addressText}>{data.client_email}</Text>}
            {data.client_address && <Text style={minimalStyles.addressText}>{data.client_address}</Text>}
          </View>
        </View>

        <View style={minimalStyles.tableHeader}>
          <Text style={[minimalStyles.tableHeaderText, minimalStyles.colDescription]}>Item</Text>
          <Text style={[minimalStyles.tableHeaderText, minimalStyles.colQty]}>Qty</Text>
          <Text style={[minimalStyles.tableHeaderText, minimalStyles.colPrice]}>Price</Text>
          <Text style={[minimalStyles.tableHeaderText, minimalStyles.colAmount]}>Total</Text>
        </View>
        {data.items.map((item, i) => (
          <View key={i} style={minimalStyles.tableRow}>
            <Text style={minimalStyles.colDescription}>{item.description}</Text>
            <Text style={minimalStyles.colQty}>{item.quantity}</Text>
            <Text style={minimalStyles.colPrice}>{formatCurrency(item.unit_price, data.currency)}</Text>
            <Text style={minimalStyles.colAmount}>{formatCurrency(item.quantity * item.unit_price, data.currency)}</Text>
          </View>
        ))}

        <View style={minimalStyles.totalsBlock}>
          <View style={minimalStyles.totalsRow}>
            <Text style={minimalStyles.totalsLabel}>Subtotal</Text>
            <Text style={minimalStyles.totalsValue}>{formatCurrency(data.subtotal, data.currency)}</Text>
          </View>
          {data.tax_rate > 0 && (
            <View style={minimalStyles.totalsRow}>
              <Text style={minimalStyles.totalsLabel}>Tax ({data.tax_rate}%)</Text>
              <Text style={minimalStyles.totalsValue}>{formatCurrency(data.tax_amount, data.currency)}</Text>
            </View>
          )}
          {data.discount > 0 && (
            <View style={minimalStyles.totalsRow}>
              <Text style={minimalStyles.totalsLabel}>Discount</Text>
              <Text style={minimalStyles.totalsValue}>-{formatCurrency(data.discount, data.currency)}</Text>
            </View>
          )}
          <View style={minimalStyles.totalFinal}>
            <Text style={minimalStyles.totalLabel}>Total</Text>
            <Text style={minimalStyles.totalValue}>{formatCurrency(data.total, data.currency)}</Text>
          </View>
        </View>

        {data.notes && <Text style={minimalStyles.notes}>{data.notes}</Text>}

        <Text style={minimalStyles.footer}>
          {data.company_name || 'Invoice'} — {data.invoice_number}
        </Text>
      </Page>
    </Document>
  );
}

// ─── Template Registry ───────────────────────────────────────────────────────

export const TEMPLATES = {
  classic: { name: 'Classic', component: ClassicTemplate },
  modern: { name: 'Modern', component: ModernTemplate },
  minimal: { name: 'Minimal', component: MinimalTemplate },
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export function InvoicePDF({ data }: { data: InvoiceData }) {
  const templateKey = (data.template || 'classic') as TemplateName;
  const Template = TEMPLATES[templateKey]?.component || ClassicTemplate;
  return <Template data={data} />;
}
