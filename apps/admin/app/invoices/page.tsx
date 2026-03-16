'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import ProtectedLayout from '@/components/protected-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { invoicesApi } from '@/lib/api';
import { useTimezone } from '@/lib/timezone';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  EyeIcon,
  XMarkIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import type { InvoiceData } from '@/components/invoice-pdf-template';
import { TEMPLATES } from '@/components/invoice-pdf-template';
import { invoiceFormSchema, formToInvoiceData, FieldError } from './schemas/invoice-form';
import type { InvoiceFormValues } from './schemas/invoice-form';
import { Pagination } from '@/components/ui/pagination';

// Lazy-load PDF components (client-side only) to avoid SSR issues with @react-pdf/renderer
const InvoicePDFPreview = dynamic(
  () => import('@/components/invoice-pdf-preview'),
  { ssr: false, loading: () => <div className="h-[680px] bg-gray-50 rounded-lg animate-pulse" /> }
);
const PDFDownloadButton = dynamic(
  () => import('@/components/invoice-pdf-preview').then(mod => ({ default: mod.PDFDownloadButton })),
  { ssr: false }
);
const PDFFullViewer = dynamic(
  () => import('@/components/invoice-pdf-preview').then(mod => ({ default: mod.PDFFullViewer })),
  { ssr: false }
);

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL'];

const defaultValues: InvoiceFormValues = {
  invoice_number: '',
  status: 'draft',
  currency: 'USD',
  issued_date: new Date().toISOString().split('T')[0],
  due_date: '',
  tax_rate: 0,
  discount: 0,
  notes: '',
  client_name: '',
  client_email: '',
  client_address: '',
  company_name: '',
  company_email: '',
  company_address: '',
  company_phone: '',
  company_logo_url: '',
  template: 'classic',
  items: [{ description: '', quantity: 1, unit_price: 0, amount: 0 }],
};

export default function InvoicesPage() {
  const { formatDate } = useTimezone();

  // List state
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const itemsPerPage = 20;

  // Editor state
  const [mode, setMode] = useState<'list' | 'edit' | 'preview'>('list');
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Preview state
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceData | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // ── Form ──
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues,
    mode: 'onSubmit',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const watchedValues = form.watch();
  const liveData = formToInvoiceData(watchedValues);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * itemsPerPage;
      const params: { limit: number; offset: number; status?: string } = { limit: itemsPerPage, offset };
      if (statusFilter) params.status = statusFilter;
      const response = await invoicesApi.list(params);
      setInvoices(response.data || []);
      setTotalPages(Math.ceil((response.pagination?.total || 0) / itemsPerPage));
    } catch {
      setPageError('Failed to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => { void loadInvoices(); }, [loadInvoices]);

  const openEditor = (data: InvoiceFormValues, id: number | null) => {
    form.reset(data);
    setEditId(id);
    setPageError(null);
    setMode('edit');
  };

  const handleNew = async () => {
    try {
      const res = await invoicesApi.nextNumber();
      openEditor({ ...defaultValues, invoice_number: res.data.invoice_number }, null);
    } catch {
      setPageError('Failed to generate invoice number.');
    }
  };

  const handleEdit = async (id: number) => {
    try {
      const res = await invoicesApi.get(id);
      const inv = res.data;
      openEditor({
        invoice_number: inv.invoice_number || '',
        status: inv.status || 'draft',
        currency: inv.currency || 'USD',
        issued_date: inv.issued_date || '',
        due_date: inv.due_date || '',
        tax_rate: inv.tax_rate || 0,
        discount: inv.discount || 0,
        notes: inv.notes || '',
        client_name: inv.client_name || '',
        client_email: inv.client_email || '',
        client_address: inv.client_address || '',
        company_name: inv.company_name || '',
        company_email: inv.company_email || '',
        company_address: inv.company_address || '',
        company_phone: inv.company_phone || '',
        company_logo_url: inv.company_logo_url || '',
        template: inv.template || 'classic',
        items: inv.items?.length
          ? inv.items.map((i: { description: string; quantity: number; unit_price: number; amount?: number }) => ({
              description: i.description,
              quantity: i.quantity,
              unit_price: i.unit_price,
              amount: i.amount || i.quantity * i.unit_price,
            }))
          : [{ description: '', quantity: 1, unit_price: 0, amount: 0 }],
      }, id);
    } catch {
      setPageError('Failed to load invoice.');
    }
  };

  const handlePreview = async (id: number) => {
    try {
      const res = await invoicesApi.get(id);
      setPreviewInvoice(res.data);
      setMode('preview');
    } catch {
      setPageError('Failed to load invoice.');
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      const res = await invoicesApi.get(id);
      const nextNum = await invoicesApi.nextNumber();
      const inv = res.data;
      openEditor({
        invoice_number: nextNum.data.invoice_number,
        status: 'draft',
        currency: inv.currency || 'USD',
        issued_date: inv.issued_date || '',
        due_date: inv.due_date || '',
        tax_rate: inv.tax_rate || 0,
        discount: inv.discount || 0,
        notes: inv.notes || '',
        client_name: inv.client_name || '',
        client_email: inv.client_email || '',
        client_address: inv.client_address || '',
        company_name: inv.company_name || '',
        company_email: inv.company_email || '',
        company_address: inv.company_address || '',
        company_phone: inv.company_phone || '',
        company_logo_url: inv.company_logo_url || '',
        template: inv.template || 'classic',
        items: inv.items?.length
          ? inv.items.map((i: { description: string; quantity: number; unit_price: number; amount?: number }) => ({
              description: i.description,
              quantity: i.quantity,
              unit_price: i.unit_price,
              amount: i.amount || i.quantity * i.unit_price,
            }))
          : [{ description: '', quantity: 1, unit_price: 0, amount: 0 }],
      }, null);
    } catch {
      setPageError('Failed to duplicate invoice.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this invoice?')) return;
    try {
      await invoicesApi.delete(id);
      void loadInvoices();
    } catch {
      setPageError('Failed to delete invoice.');
    }
  };

  const onSubmit = async (values: InvoiceFormValues) => {
    try {
      setSaving(true);
      setPageError(null);
      const data = formToInvoiceData(values);
      // Convert empty strings to null for optional nullable backend fields
      const emptyToNull = (v: string | undefined) => v?.trim() || null;
      const payload = {
        ...data,
        client_name: emptyToNull(data.client_name),
        client_email: emptyToNull(data.client_email),
        client_address: emptyToNull(data.client_address),
        company_name: emptyToNull(data.company_name),
        company_email: emptyToNull(data.company_email),
        company_address: emptyToNull(data.company_address),
        company_phone: emptyToNull(data.company_phone),
        company_logo_url: emptyToNull(data.company_logo_url),
        notes: emptyToNull(data.notes),
        due_date: emptyToNull(data.due_date),
        issued_date: emptyToNull(data.issued_date),
        invoice_number: emptyToNull(data.invoice_number),
        items: data.items.filter(i => i.description.trim()),
      };
      if (editId) {
        await invoicesApi.update(editId, payload);
      } else {
        await invoicesApi.create(payload);
      }
      setMode('list');
      void loadInvoices();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string; details?: Array<{ path: string[]; message: string }> } } };
      const details = axiosErr?.response?.data?.details;
      if (details?.length) {
        setPageError(details.map(d => `${d.path.join('.')}: ${d.message}`).join('. '));
      } else {
        const errMsg = axiosErr?.response?.data?.error;
        setPageError(typeof errMsg === 'string' ? errMsg : 'Failed to save invoice.');
      }
    } finally {
      setSaving(false);
    }
  };

  const formatMoney = (amount: number, currency: string) => {
    const symbols: Record<string, string> = { USD: '$', EUR: '\u20AC', GBP: '\u00A3', JPY: '\u00A5' };
    return `${symbols[currency] || currency + ' '}${amount.toFixed(2)}`;
  };

  // ── Preview mode ──
  if (mode === 'preview' && previewInvoice) {
    return (
      <ProtectedLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Preview — {previewInvoice.invoice_number}
            </h1>
            <div className="flex gap-2">
              <PDFDownloadButton data={previewInvoice} />
              <Button variant="outline" onClick={() => { setMode('list'); setPreviewInvoice(null); }}>
                <XMarkIcon className="h-4 w-4 mr-1" /> Close
              </Button>
            </div>
          </div>
          <PDFFullViewer data={previewInvoice} />
        </div>
      </ProtectedLayout>
    );
  }

  // ── Edit mode ──
  if (mode === 'edit') {
    const { formState: { errors } } = form;

    return (
      <ProtectedLayout>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              {editId ? 'Edit Invoice' : 'New Invoice'}
            </h1>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setPreviewInvoice(liveData); setMode('preview'); }}
                className="flex items-center gap-2"
              >
                <EyeIcon className="h-4 w-4" /> Preview
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Invoice'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setMode('list')}>Cancel</Button>
            </div>
          </div>

          {pageError && (
            <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {pageError}
              <button type="button" onClick={() => setPageError(null)} className="ml-4 font-medium">&#x2715;</button>
            </div>
          )}

          {/* Form-level error summary */}
          {Object.keys(errors).length > 0 && !pageError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Please fix the highlighted fields below before saving.
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Left: Form */}
            <div className="space-y-6">
              {/* Invoice details */}
              <Card>
                <CardHeader><CardTitle>Invoice Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                      <Input {...form.register('invoice_number')} className={errors.invoice_number ? 'border-red-400' : ''} />
                      <FieldError message={errors.invoice_number?.message} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        {...form.register('status')}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                      <Input type="date" {...form.register('issued_date')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                      <Input type="date" {...form.register('due_date')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                      <select
                        {...form.register('currency')}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                      <select
                        {...form.register('template')}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {Object.entries(TEMPLATES).map(([key, t]) => (
                          <option key={key} value={key}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Company info */}
              <Card>
                <CardHeader><CardTitle>Your Company</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                      <Input {...form.register('company_name')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <Input type="email" {...form.register('company_email')} className={errors.company_email ? 'border-red-400' : ''} />
                      <FieldError message={errors.company_email?.message} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <Input {...form.register('company_phone')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                      <Input {...form.register('company_address')} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client info */}
              <Card>
                <CardHeader><CardTitle>Client</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                      <Input {...form.register('client_name')} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <Input type="email" {...form.register('client_email')} className={errors.client_email ? 'border-red-400' : ''} />
                      <FieldError message={errors.client_email?.message} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <Input {...form.register('client_address')} />
                  </div>
                </CardContent>
              </Card>

              {/* Line items */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Line Items</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ description: '', quantity: 1, unit_price: 0, amount: 0 })}
                      className="flex items-center gap-1"
                    >
                      <PlusIcon className="h-4 w-4" /> Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {errors.items?.root?.message && (
                    <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
                      {errors.items.root.message}
                    </div>
                  )}
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase">
                      <div className="col-span-5">Description</div>
                      <div className="col-span-2">Qty</div>
                      <div className="col-span-2">Unit Price</div>
                      <div className="col-span-2 text-right">Amount</div>
                      <div className="col-span-1"></div>
                    </div>
                    {fields.map((field, i) => (
                      <div key={field.id}>
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5">
                            <Input
                              placeholder="Description"
                              {...form.register(`items.${i}.description`)}
                              className={errors.items?.[i]?.description ? 'border-red-400' : ''}
                            />
                          </div>
                          <div className="col-span-2">
                            <Controller
                              control={form.control}
                              name={`items.${i}.quantity`}
                              render={({ field: f }) => (
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={f.value}
                                  onChange={e => f.onChange(parseFloat(e.target.value) || 0)}
                                  className={errors.items?.[i]?.quantity ? 'border-red-400' : ''}
                                />
                              )}
                            />
                          </div>
                          <div className="col-span-2">
                            <Controller
                              control={form.control}
                              name={`items.${i}.unit_price`}
                              render={({ field: f }) => (
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={f.value}
                                  onChange={e => f.onChange(parseFloat(e.target.value) || 0)}
                                  className={errors.items?.[i]?.unit_price ? 'border-red-400' : ''}
                                />
                              )}
                            />
                          </div>
                          <div className="col-span-2 text-right text-sm font-medium">
                            {formatMoney(
                              (watchedValues.items?.[i]?.quantity || 0) * (watchedValues.items?.[i]?.unit_price || 0),
                              watchedValues.currency
                            )}
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => { if (fields.length > 1) remove(i); }}
                              className="text-gray-400 hover:text-red-500"
                              disabled={fields.length <= 1}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {/* Per-row errors */}
                        {(errors.items?.[i]?.description || errors.items?.[i]?.quantity || errors.items?.[i]?.unit_price) && (
                          <div className="grid grid-cols-12 gap-2 mt-0.5">
                            <div className="col-span-5"><FieldError message={errors.items?.[i]?.description?.message} /></div>
                            <div className="col-span-2"><FieldError message={errors.items?.[i]?.quantity?.message} /></div>
                            <div className="col-span-2"><FieldError message={errors.items?.[i]?.unit_price?.message} /></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-6 border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-medium">{formatMoney(liveData.subtotal, liveData.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Tax Rate (%)</span>
                        <Controller
                          control={form.control}
                          name="tax_rate"
                          render={({ field: f }) => (
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              className={`w-20 h-7 text-sm ${errors.tax_rate ? 'border-red-400' : ''}`}
                              value={f.value}
                              onChange={e => f.onChange(parseFloat(e.target.value) || 0)}
                            />
                          )}
                        />
                      </div>
                      <span className="font-medium">{formatMoney(liveData.tax_amount, liveData.currency)}</span>
                    </div>
                    {errors.tax_rate && <FieldError message={errors.tax_rate.message} />}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Discount</span>
                        <Controller
                          control={form.control}
                          name="discount"
                          render={({ field: f }) => (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className={`w-24 h-7 text-sm ${errors.discount ? 'border-red-400' : ''}`}
                              value={f.value}
                              onChange={e => f.onChange(parseFloat(e.target.value) || 0)}
                            />
                          )}
                        />
                      </div>
                      <span className="font-medium">-{formatMoney(liveData.discount, liveData.currency)}</span>
                    </div>
                    {errors.discount && <FieldError message={errors.discount.message} />}
                    <div className="flex justify-between text-base font-bold border-t pt-3">
                      <span>Total</span>
                      <span>{formatMoney(liveData.total, liveData.currency)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
                <CardContent>
                  <textarea
                    rows={3}
                    className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y ${errors.notes ? 'border-red-400' : ''}`}
                    placeholder="Payment terms, bank details, thank you note..."
                    {...form.register('notes')}
                  />
                  <FieldError message={errors.notes?.message} />
                </CardContent>
              </Card>
            </div>

            {/* Right: Live PDF Preview (opt-in) */}
            <div className="hidden xl:block">
              <div className="sticky top-8">
                {showLivePreview ? (
                  <InvoicePDFPreview data={liveData} onDisable={() => setShowLivePreview(false)} />
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                      <EyeIcon className="h-10 w-10 text-gray-300 mb-3" />
                      <p className="text-sm text-gray-500 mb-4">
                        Live preview renders the PDF in real time as you type
                      </p>
                      <Button type="button" variant="outline" onClick={() => setShowLivePreview(true)} className="flex items-center gap-2">
                        <EyeIcon className="h-4 w-4" /> Enable Live Preview
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </form>
      </ProtectedLayout>
    );
  }

  // ── List mode ──
  return (
    <ProtectedLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="mt-2 text-gray-600">Create, manage, and download PDF invoices.</p>
        </div>

        {pageError && (
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {pageError}
            <button onClick={() => setPageError(null)} className="ml-4 font-medium">&#x2715;</button>
          </div>
        )}

        {/* Filters & actions */}
        <div className="flex items-center justify-between">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Button onClick={handleNew} className="flex items-center gap-2">
            <PlusIcon className="h-4 w-4" /> New Invoice
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                <p className="text-lg font-medium">No invoices yet</p>
                <p className="mt-1 text-sm">Create your first invoice to get started.</p>
                <Button onClick={handleNew} className="mt-4">
                  <PlusIcon className="h-4 w-4 mr-2" /> Create Invoice
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-sm">Invoice #</th>
                      <th className="text-left p-3 font-medium text-sm">Client</th>
                      <th className="text-left p-3 font-medium text-sm">Status</th>
                      <th className="text-right p-3 font-medium text-sm">Total</th>
                      <th className="text-left p-3 font-medium text-sm">Issued</th>
                      <th className="text-left p-3 font-medium text-sm">Due</th>
                      <th className="text-right p-3 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b hover:bg-gray-50 group/row">
                        <td className="p-3">
                          <span className="font-mono text-sm font-medium">{inv.invoice_number}</span>
                        </td>
                        <td className="p-3 text-sm text-gray-700">{inv.client_name || '-'}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status as InvoiceStatus] || STATUS_COLORS.draft}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-3 text-right text-sm font-medium">
                          {formatMoney(inv.total, inv.currency)}
                        </td>
                        <td className="p-3 text-sm text-gray-500">
                          {inv.issued_date ? formatDate(inv.issued_date) : '-'}
                        </td>
                        <td className="p-3 text-sm text-gray-500">
                          {inv.due_date ? formatDate(inv.due_date) : '-'}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" onClick={() => handlePreview(inv.id!)} title="Preview">
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(inv.id!)} title="Edit">
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDuplicate(inv.id!)} title="Duplicate">
                              <DocumentDuplicateIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id!)} title="Delete" className="text-gray-400 hover:text-red-500">
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} className="" />
      </div>
    </ProtectedLayout>
  );
}
