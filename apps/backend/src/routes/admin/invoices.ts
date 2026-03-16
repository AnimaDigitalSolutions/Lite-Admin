/// <reference path="../../types/express.d.ts" />
import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.js';
import { invoiceListQuerySchema, invoiceIdSchema, invoiceCreateSchema, invoiceUpdateSchema } from '../../schemas/invoice.js';
import DatabaseService from '../../services/database.service.js';

const router = Router();

// List invoices
router.get('/invoices', validateQuery(invoiceListQuerySchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { limit, offset, status } = req.validatedQuery;
    const [invoices, total] = await Promise.all([
      db.invoices.findAll(limit, offset, status),
      db.invoices.count(status),
    ]);
    res.json({ success: true, data: invoices, pagination: { limit, offset, total } });
  } catch (error) { next(error); }
});

// Get single invoice with items
router.get('/invoices/:id', validateParams(invoiceIdSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { id } = req.validatedParams;
    const invoice = await db.invoices.findById(id);
    if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });
    const items = await db.invoiceItems.findByInvoiceId(id);
    res.json({ success: true, data: { ...invoice, items } });
  } catch (error) { next(error); }
});

// Create invoice
router.post('/invoices', validateBody(invoiceCreateSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const data = req.validatedBody;
    const items = data.items || [];

    // Calculate totals
    const subtotal = items.reduce((sum: number, item: { quantity: number; unit_price: number }) => sum + item.quantity * item.unit_price, 0);
    const taxAmount = subtotal * (data.tax_rate || 0) / 100;
    const total = subtotal + taxAmount - (data.discount || 0);

    // Auto-generate invoice number if not provided
    const invoiceNumber = data.invoice_number || await db.invoices.nextNumber();

    const invoice = await db.invoices.create({
      ...data,
      invoice_number: invoiceNumber,
      subtotal,
      tax_amount: taxAmount,
      total,
    });

    if (items.length > 0 && invoice.id) {
      await db.invoiceItems.createMany(
        invoice.id,
        items.map((item: { description: string; quantity: number; unit_price: number }) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.quantity * item.unit_price,
        }))
      );
    }

    const createdItems = invoice.id ? await db.invoiceItems.findByInvoiceId(invoice.id) : [];

    await db.adminLogs.create({
      action: 'create',
      resource: 'invoice',
      resource_id: invoice.id,
      details: `Created invoice ${invoiceNumber}`,
      ip_address: req.ip,
    });

    res.status(201).json({ success: true, data: { ...invoice, items: createdItems } });
  } catch (error) { next(error); }
});

// Update invoice
router.patch('/invoices/:id', validateParams(invoiceIdSchema), validateBody(invoiceUpdateSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { id } = req.validatedParams;
    const data = req.validatedBody;

    const existing = await db.invoices.findById(id);
    if (!existing) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });

    // If items are provided, recalculate totals
    const items = data.items;
    if (items) {
      const subtotal = items.reduce((sum: number, item: { quantity: number; unit_price: number }) => sum + item.quantity * item.unit_price, 0);
      const taxRate = data.tax_rate ?? existing.tax_rate;
      const discount = data.discount ?? existing.discount;
      const taxAmount = subtotal * taxRate / 100;
      data.subtotal = subtotal;
      data.tax_amount = taxAmount;
      data.total = subtotal + taxAmount - discount;

      // Replace items
      await db.invoiceItems.deleteByInvoiceId(id);
      await db.invoiceItems.createMany(
        id,
        items.map((item: { description: string; quantity: number; unit_price: number }) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.quantity * item.unit_price,
        }))
      );
    }

    // Remove items from update data (it's not a column)
    delete data.items;

    const updated = await db.invoices.updateById(id, data);
    const updatedItems = await db.invoiceItems.findByInvoiceId(id);

    await db.adminLogs.create({
      action: 'update',
      resource: 'invoice',
      resource_id: id,
      details: `Updated invoice ${existing.invoice_number}`,
      ip_address: req.ip,
    });

    res.json({ success: true, data: { ...updated, items: updatedItems } });
  } catch (error) { next(error); }
});

// Delete invoice
router.delete('/invoices/:id', validateParams(invoiceIdSchema), async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const { id } = req.validatedParams;
    const invoice = await db.invoices.findById(id);
    if (!invoice) return res.status(404).json({ error: { message: 'Invoice not found', status: 404 } });

    await db.invoices.deleteById(id);

    await db.adminLogs.create({
      action: 'delete',
      resource: 'invoice',
      resource_id: id,
      details: `Deleted invoice ${invoice.invoice_number}`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: 'Invoice deleted' });
  } catch (error) { next(error); }
});

// Get next invoice number
router.get('/invoices-next-number', async (req, res, next) => {
  try {
    const db = await DatabaseService.getInstance();
    const nextNumber = await db.invoices.nextNumber();
    res.json({ success: true, data: { invoice_number: nextNumber } });
  } catch (error) { next(error); }
});

export default router;
