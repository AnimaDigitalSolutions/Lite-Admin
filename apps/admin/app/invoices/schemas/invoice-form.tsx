import { z } from 'zod';
import type { InvoiceData } from '@/components/invoice-pdf-template';

// ── Zod schema (mirrors backend validation) ──
const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Max 500 characters'),
  quantity: z.number({ invalid_type_error: 'Required' }).positive('Must be > 0'),
  unit_price: z.number({ invalid_type_error: 'Required' }).min(0, 'Cannot be negative'),
  amount: z.number(),
});

const optionalEmail = z.string().max(255).refine(
  (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  { message: 'Invalid email' },
);

export const invoiceFormSchema = z.object({
  invoice_number: z.string().max(50),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  currency: z.string().max(3),
  issued_date: z.string(),
  due_date: z.string(),
  tax_rate: z.number().min(0, 'Cannot be negative').max(100, 'Max 100%'),
  discount: z.number().min(0, 'Cannot be negative'),
  notes: z.string().max(2000, 'Max 2000 characters'),
  client_name: z.string().max(200),
  client_email: optionalEmail,
  client_address: z.string().max(500),
  company_name: z.string().max(200),
  company_email: optionalEmail,
  company_address: z.string().max(500),
  company_phone: z.string().max(50),
  company_logo_url: z.string().max(500),
  template: z.string().max(50),
  items: z.array(lineItemSchema).min(1, 'At least one line item is required'),
});

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export function formToInvoiceData(values: InvoiceFormValues): InvoiceData {
  const subtotal = values.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tax_amount = subtotal * (values.tax_rate || 0) / 100;
  const total = subtotal + tax_amount - (values.discount || 0);
  return {
    ...values,
    subtotal,
    tax_amount,
    total,
    items: values.items.map(i => ({ ...i, amount: i.quantity * i.unit_price })),
  };
}

// ── Helper: inline error text ──
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}
