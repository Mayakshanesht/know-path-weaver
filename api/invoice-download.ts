import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabaseAdmin, supabaseAsCaller } from './_lib/groq.js';

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
  email: process.env.INVOICE_SELLER_EMAIL ?? 'support@knowgraph.com',
  taxId: process.env.INVOICE_SELLER_TAX_ID ?? '',
};

interface Invoice {
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
      const pdf = await renderInvoice(invoice);
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

async function renderInvoice(invoice: Invoice): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width } = page.getSize();
  const left = 50;
  const right = width - 50;

  const text = (v: string, x: number, y: number, size = 10, b = false, color = BRAND) =>
    page.drawText(v, { x, y, size, font: b ? bold : font, color });

  const rightText = (v: string, y: number, size = 10, b = false, color = BRAND) => {
    const f = b ? bold : font;
    page.drawText(v, { x: right - f.widthOfTextAtSize(v, size), y, size, font: f, color });
  };

  page.drawRectangle({ x: 0, y: 762, width, height: 80, color: BRAND });
  page.drawText('KnowGraph', { x: left, y: 795, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText('INVOICE', {
    x: right - bold.widthOfTextAtSize('INVOICE', 20),
    y: 795,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });

  let y = 720;
  text('Billed to', left, y, 9, true, MUTED);
  rightText('Invoice number', y, 9, true, MUTED);

  y -= 16;
  text(invoice.buyer_name || 'Learner', left, y, 12, true);
  rightText(invoice.invoice_number, y, 12, true);

  y -= 15;
  text(invoice.buyer_email || '', left, y, 10, false, MUTED);
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
  text(SELLER.name, left, y, 11, true);
  y -= 14;
  if (SELLER.address) {
    text(SELLER.address, left, y, 10, false, MUTED);
    y -= 14;
  }
  text(SELLER.email, left, y, 10, false, MUTED);
  if (SELLER.taxId) {
    y -= 14;
    text(`Tax ID: ${SELLER.taxId}`, left, y, 10, false, MUTED);
  }

  y -= 46;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 18;
  text('Description', left, y, 9, true, MUTED);
  rightText('Amount', y, 9, true, MUTED);
  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });

  y -= 24;
  text(invoice.course_title, left, y, 11);
  rightText(money(invoice.amount, invoice.currency), y, 11);
  y -= 14;
  text('Course enrollment — lifetime access', left, y, 9, false, MUTED);

  y -= 26;
  page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 26;
  text('Total paid', left, y, 12, true);
  rightText(money(invoice.amount, invoice.currency), y, 14, true);

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
