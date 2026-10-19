import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabaseAdmin, supabaseAsCaller } from './_lib/groq.js';
import { logoBytes } from './_lib/logo.js';

/**
 * Returns a signed URL for an invoice PDF, rendering it on demand if it does not
 * exist yet.
 *
 * The original design pre-rendered each PDF from a Supabase edge function, fired by
 * a pg_net trigger on approval. That never worked here: we have no CLI access to
 * deploy edge functions to this project, so the function 404s and storage_path stayed
 * null forever. Rendering lazily on first download removes the trigger, the webhook,
 * the vault secrets and the edge function from the picture entirely — and it also
 * means the 39 enrollments that were approved before any of this existed still get an
 * invoice, because the first download creates it.
 *
 * The bucket is private, so this endpoint is the only way in. Authorisation comes from
 * the caller's JWT: the SELECT runs as them, so RLS ("own invoices, or admin") decides
 * what they can see. Asking for someone else's invoice_id returns 404, not their PDF.
 */

export const config = { maxDuration: 30 };

const BRAND = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.88, 0.9, 0.92);

const SELLER = {
  name: process.env.INVOICE_SELLER_NAME ?? 'KnowGraph',
  address: process.env.INVOICE_SELLER_ADDRESS ?? '',
  email: process.env.INVOICE_SELLER_EMAIL ?? 'mayurwaghchoure1995@gmail.com',
  taxId: process.env.INVOICE_SELLER_TAX_ID ?? '',
};

export interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: 'INR' | 'EUR';
  region: 'india' | 'international';
  billing_country: string | null;
  course_title: string;
  buyer_name: string | null;
  buyer_email: string | null;
  period_year: number;
  period_month: number;
  issued_at: string;
  storage_path: string | null;

  // The tax breakdown, computed when the invoice was issued. The listed price is the total
  // the buyer paid; base and tax are broken out OF it, never added on top.
  base_amount: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  tax_label: string | null;
  seller_gstin: string | null;

  // GST is CGST+SGST when the buyer is in the seller's own state, and IGST otherwise. The
  // place of supply is the buyer's state, captured at the point of sale — it cannot be
  // recovered afterwards.
  place_of_supply: string | null;
  cgst_amount: number | null;
  sgst_amount: number | null;
  igst_amount: number | null;
  document_type?: 'tax_invoice' | 'sponsorship_receipt';
  list_price?: number | null;
  discount_amount?: number | null;
  discount_percent?: number | null;
  coupon_code?: string | null;
  sponsorship_campaign?: string | null;
  team_name?: string | null;
}

interface Seller {
  legal_name: string;
  address: string | null;
  gstin: string | null;
  place_of_supply: string | null;
}

/** Break a long line so it cannot run off the edge of the page. */
function wrap(value: string, maxChars: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars && line) {
      lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

const money = (amount: number, currency: string) =>
  `${currency === 'INR' ? 'INR' : 'EUR'} ${Number(amount).toFixed(2)}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Not authenticated' });

  const { invoice_id: invoiceId } = (req.body ?? {}) as { invoice_id?: string };
  if (!invoiceId) return res.status(400).json({ error: 'invoice_id is required' });

  const asCaller = supabaseAsCaller(authHeader);

  const {
    data: { user },
  } = await asCaller.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  // Runs as the caller: RLS is what decides whether they may see this invoice.
  const { data: invoice } = await asCaller
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle<Invoice>();

  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  try {
    const admin = supabaseAdmin();
    let path = invoice.storage_path;

    // Not rendered yet — do it now. Month-partitioned, so a year-end tax export is a
    // prefix listing rather than a scan.
    if (!path) {
      // The registered legal name, address and GSTIN live in billing_settings so they can be
      // corrected without a deploy. A tax invoice needs all three, not just the number.
      const { data: settings } = await admin
        .from('billing_settings')
        .select('legal_name, address, gstin, place_of_supply')
        .maybeSingle<Seller>();

      const pdf = await renderInvoice(invoice, settings ?? null);
      const month = String(invoice.period_month).padStart(2, '0');
      path = `${invoice.period_year}/${month}/${invoice.invoice_number}.pdf`;

      const { error: uploadError } = await admin.storage
        .from('invoices')
        .upload(path, pdf, { contentType: 'application/pdf', upsert: true });

      if (uploadError) throw new Error(uploadError.message);

      await admin.from('invoices').update({ storage_path: path }).eq('id', invoice.id);
    }

    const { data: signed, error: signError } = await admin.storage
      .from('invoices')
      .createSignedUrl(path, 60, { download: `${invoice.invoice_number}.pdf` });

    if (signError || !signed) throw new Error(signError?.message ?? 'Could not sign URL');

    return res.status(200).json({ url: signed.signedUrl, invoice_number: invoice.invoice_number });
  } catch (error) {
    console.error('invoice-download failed:', error);
    return res.status(500).json({ error: String(error) });
  }
}

export async function renderInvoice(invoice: Invoice, seller: Seller | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width } = page.getSize();
  const left = 50;
  const right = width - 50;
  const sponsored = invoice.document_type === 'sponsorship_receipt';
  // Standard PDF fonts cannot encode every Unicode character. Keep the original
  // values in the database and make an unsupported glyph printable in the PDF.
  const characterSet = new Set(font.getCharacterSet());
  const printable = (value: string) => Array.from(value)
    .map((character) => characterSet.has(character.codePointAt(0)!) ? character : '?').join('');

  const text = (v: string, x: number, y: number, size = 10, b = false, color = BRAND) =>
    page.drawText(printable(v), { x, y, size, font: b ? bold : font, color });

  const rightText = (v: string, y: number, size = 10, b = false, color = BRAND) => {
    const f = b ? bold : font;
    const value = printable(v);
    page.drawText(value, { x: right - f.widthOfTextAtSize(value, size), y, size, font: f, color });
  };

  page.drawRectangle({ x: 0, y: 762, width, height: 80, color: BRAND });

  // The real logo, embedded rather than read from disk — a serverless bundle does not
  // carry src/assets, so a file read would silently render no logo in production.
  try {
    const logo = await doc.embedPng(logoBytes());
    const logoHeight = 30;
    const logoWidth = (logo.width / logo.height) * logoHeight;
    page.drawImage(logo, { x: left, y: 787, width: logoWidth, height: logoHeight });
  } catch {
    // A missing logo must never cost someone their invoice.
    page.drawText('KnowGraph', { x: left, y: 795, size: 20, font: bold, color: rgb(1, 1, 1) });
  }

  const documentTitle = sponsored ? 'SPONSORED ACCESS RECEIPT' : 'INVOICE';
  const titleSize = sponsored ? 12 : 20;
  page.drawText(documentTitle, {
    x: right - bold.widthOfTextAtSize(documentTitle, titleSize),
    y: 795,
    size: titleSize,
    font: bold,
    color: rgb(1, 1, 1),
  });

  let y = 720;
  text(sponsored ? 'Access granted to' : 'Billed to', left, y, 9, true, MUTED);
  rightText(sponsored ? 'Receipt number' : 'Invoice number', y, 9, true, MUTED);

  y -= 16;
  text((invoice.buyer_name || 'Learner').slice(0, 45), left, y, 12, true);
  rightText(invoice.invoice_number, y, 12, true);

  y -= 15;
  text((invoice.buyer_email || '').slice(0, 58), left, y, 10, false, MUTED);
  rightText(
    new Date(invoice.issued_at).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    y,
    10,
    false,
    MUTED
  );

  y -= 15;
  if (invoice.billing_country) text(`Country: ${invoice.billing_country}`, left, y, 10, false, MUTED);
  rightText(invoice.region === 'india' ? 'Domestic (India)' : 'International', y, 10, false, MUTED);

  y -= 40;
  text('From', left, y, 9, true, MUTED);
  y -= 16;
  text(seller?.legal_name || SELLER.name, left, y, 11, true);

  // The registered address, wrapped — it is one long line and would otherwise run off the
  // page and out of the PDF entirely.
  const address = seller?.address ?? SELLER.address;
  if (address) {
    for (const line of wrap(address, 58)) {
      y -= 13;
      text(line, left, y, 9, false, MUTED);
    }
  }

  y -= 14;
  text(SELLER.email, left, y, 10, false, MUTED);

  // The GSTIN recorded on the invoice when it was issued wins over the current setting: if
  // the number ever changes, an old invoice must keep showing the one in force at the sale.
  const gstin = invoice.seller_gstin || seller?.gstin || SELLER.taxId;
  if (gstin) {
    y -= 14;
    text(`GSTIN: ${gstin}`, left, y, 10, true);
  }
  if (seller?.place_of_supply) {
    y -= 13;
    text(`State: ${seller.place_of_supply}`, left, y, 9, false, MUTED);
  }
  if (invoice.place_of_supply) {
    y -= 13;
    text(`Place of supply: ${invoice.place_of_supply}`, left, y, 9, false, MUTED);
  }

  if (sponsored) {
    // Sponsorship is recorded separately from tax invoices and collected revenue.
    // These are immutable price/discount snapshots, never the current course price.
    y -= 35;
    for (const line of wrap(invoice.course_title, 65).slice(0, 3)) {
      text(line, left, y, 11, true);
      y -= 15;
    }
    for (const line of wrap(`Programme: ${invoice.sponsorship_campaign || 'Sponsored learning'}`, 85).slice(0, 2)) {
      text(line, left, y, 9, false, MUTED);
      y -= 13;
    }
    if (invoice.team_name) {
      for (const line of wrap(`Team: ${invoice.team_name}`, 85).slice(0, 2)) {
        text(line, left, y, 9, false, MUTED);
        y -= 13;
      }
    }
    text(`Coupon: ${invoice.coupon_code || ''}`, left, y, 9, false, MUTED);
    y -= 30;
    text('Course list price', left, y, 10);
    rightText(money(Number(invoice.list_price ?? 0), invoice.currency), y, 10);
    y -= 22;
    text('Sponsorship discount (100%)', left, y, 10);
    rightText(`-${money(Number(invoice.discount_amount ?? 0), invoice.currency)}`, y, 10);
    y -= 24;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });
    y -= 26;
    text('Amount due / collected', left, y, 12, true);
    rightText(money(Number(invoice.amount), invoice.currency), y, 14, true);
    y -= 28;
    text('Access is fully sponsored. No payment is required or recorded.', left, y, 9, false, MUTED);
    page.drawLine({ start: { x: left, y: 110 }, end: { x: right, y: 110 }, thickness: 1, color: RULE });
    text('Sponsorship access record. This document is not a tax invoice.', left, 92, 9, false, MUTED);
    text('Keep this receipt for your records.', left, 78, 9, false, MUTED);
    return await doc.save();
  }

  y -= 46;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 18;
  text('Description', left, y, 9, true, MUTED);
  rightText('Amount', y, 9, true, MUTED);
  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });

  // The listed price is what the buyer paid; the tax is shown broken out OF it, not added
  // on top. base + tax must equal the total exactly, or the invoice is not an invoice.
  const total = Number(invoice.amount);
  const base = invoice.base_amount != null ? Number(invoice.base_amount) : total;
  const tax = invoice.tax_amount != null ? Number(invoice.tax_amount) : 0;

  y -= 24;
  text(invoice.course_title, left, y, 11);
  rightText(money(base, invoice.currency), y, 11);
  y -= 14;
  text('Course enrollment — lifetime access', left, y, 9, false, MUTED);

  if (Number(invoice.discount_amount ?? 0) > 0) {
    y -= 24;
    text('Listed course price', left, y, 10, false, MUTED);
    rightText(money(Number(invoice.list_price), invoice.currency), y, 10, false, MUTED);
    y -= 16;
    text(`Coupon discount${invoice.discount_percent != null ? ` (${Number(invoice.discount_percent)}%)` : ''}`, left, y, 10, false, MUTED);
    rightText(`-${money(Number(invoice.discount_amount), invoice.currency)}`, y, 10, false, MUTED);
    y -= 16;
    text(`Coupon: ${invoice.coupon_code || ''}`, left, y, 9, false, MUTED);
    if (invoice.sponsorship_campaign) {
      y -= 14;
      text(wrap(`Programme: ${invoice.sponsorship_campaign}`, 85)[0], left, y, 9, false, MUTED);
    }
    if (invoice.team_name) {
      y -= 14;
      text(wrap(`Team: ${invoice.team_name}`, 85)[0], left, y, 9, false, MUTED);
    }
  }

  y -= 24;
  text(invoice.tax_label ?? 'Tax', left, y, 10);
  rightText(money(tax, invoice.currency), y, 10);

  y -= 22;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });

  y -= 20;
  text('Subtotal (excl. tax)', left, y, 10, false, MUTED);
  rightText(money(base, invoice.currency), y, 10, false, MUTED);

  // A valid Indian tax invoice must show CGST and SGST separately for an intra-state sale,
  // and IGST for an inter-state one. One lumped "GST" line is not enough.
  const cgst = Number(invoice.cgst_amount ?? 0);
  const sgst = Number(invoice.sgst_amount ?? 0);
  const igst = Number(invoice.igst_amount ?? 0);
  const half = (invoice.tax_rate ?? 0) / 2;

  if (cgst > 0 || sgst > 0) {
    y -= 15;
    text(`CGST @ ${half}%`, left, y, 10, false, MUTED);
    rightText(money(cgst, invoice.currency), y, 10, false, MUTED);
    y -= 15;
    text(`SGST @ ${half}%`, left, y, 10, false, MUTED);
    rightText(money(sgst, invoice.currency), y, 10, false, MUTED);
  } else if (invoice.region === 'india') {
    y -= 15;
    text(`IGST @ ${invoice.tax_rate ?? 18}%`, left, y, 10, false, MUTED);
    rightText(money(igst, invoice.currency), y, 10, false, MUTED);
  } else {
    y -= 15;
    text(invoice.tax_label ?? 'Tax', left, y, 10, false, MUTED);
    rightText(money(tax, invoice.currency), y, 10, false, MUTED);
  }

  y -= 22;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 26;
  text('Total paid', left, y, 12, true);
  rightText(money(total, invoice.currency), y, 14, true);

  page.drawLine({ start: { x: left, y: 110 }, end: { x: right, y: 110 }, thickness: 1, color: RULE });
  text('Payment received. This invoice is issued for a completed transaction.', left, 92, 9, false, MUTED);
  text(
    `Retain for your records — period ${invoice.period_year}-${String(invoice.period_month).padStart(2, '0')}.`,
    left,
    78,
    9,
    false,
    MUTED
  );

  return await doc.save();
}
