// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { renderInvoice, type Invoice } from '../../api/invoice-download';

const fixture: Invoice = {
  id: 'receipt', invoice_number: 'KGS-202610-0001', amount: 0,
  currency: 'INR', region: 'india', billing_country: null,
  course_title: 'ADAS fundamentals', buyer_name: 'Student One',
  buyer_email: 'student@example.com', period_year: 2026, period_month: 10,
  issued_at: '2026-10-19T10:00:00Z', storage_path: null,
  base_amount: 0, tax_rate: 0, tax_amount: 0, tax_label: null,
  seller_gstin: null, place_of_supply: null, cgst_amount: 0,
  sgst_amount: 0, igst_amount: 0,
  document_type: 'sponsorship_receipt', list_price: 9999,
  discount_amount: 9999, coupon_code: 'AB27-0123456789ABCDEF0123456789ABCDEF',
  sponsorship_campaign: 'SAEINDIA 2027 aBAJA', team_name: 'Team Example',
};

async function renderedText(invoice: Invoice) {
  const bytes = await renderInvoice(invoice, null);
  const doc = await PDFDocument.load(bytes);
  const contents = doc.getPages()[0].node.lookup(PDFName.of('Contents'), PDFArray);
  const streams = Array.from({ length: contents.size() }, (_, index) => {
    const stream = contents.lookup(index, PDFRawStream);
    return Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
  }).join('\n');
  return Array.from(streams.matchAll(/<([a-f0-9]+)>\s*Tj/gi), match =>
    Buffer.from(match[1], 'hex').toString('latin1')).join('\n');
}

describe('billing PDF documents', () => {
  it('shows sponsorship attribution, full discount and zero collection without a paid-transaction statement', async () => {
    const text = await renderedText(fixture);
    expect(text).toContain('SPONSORED ACCESS RECEIPT');
    expect(text).toContain('SAEINDIA 2027 aBAJA');
    expect(text).toContain('Team Example');
    expect(text).toContain(fixture.coupon_code);
    expect(text).toContain('INR 9999.00');
    expect(text).toContain('-INR 9999.00');
    expect(text).toContain('INR 0.00');
    expect(text).toContain('This document is not a tax invoice');
    expect(text).not.toContain('Payment received');
    expect(text).not.toContain('IGST @');
  });

  it('preserves the paid invoice and tax breakdown', async () => {
    const text = await renderedText({ ...fixture, document_type: 'tax_invoice',
      invoice_number: 'KG-202610-0001', amount: 1180, base_amount: 1000,
      tax_amount: 180, tax_rate: 18, igst_amount: 180 });
    expect(text).toContain('INVOICE');
    expect(text).toContain('IGST @ 18%');
    expect(text).toContain('INR 1180.00');
    expect(text).toContain('Payment received');
    expect(text).not.toContain('SPONSORED ACCESS RECEIPT');
  });

  it('renders a receipt when a participant name uses characters outside standard PDF fonts', async () => {
    const text = await renderedText({ ...fixture, buyer_name: 'विद्यार्थी Student' });
    expect(text).toContain('Student');
    expect(text).toContain('INR 0.00');
  });

  it('shows the original price and coupon discount on a paid invoice', async () => {
    const text = await renderedText({ ...fixture, document_type: 'tax_invoice',
      invoice_number: 'KG-202610-0002', list_price: 2000, discount_amount: 500, discount_percent: 25,
      amount: 1500, base_amount: 1500, tax_amount: 0 });
    expect(text).toContain('Listed course price');
    expect(text).toContain('INR 2000.00');
    expect(text).toContain('-INR 500.00');
    expect(text).toContain('Coupon discount (25%)');
    expect(text).toContain('INR 1500.00');
    expect(text).toContain('Coupon:');
  });
});
