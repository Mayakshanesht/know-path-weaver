import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

/**
 * Renders the PDF for an already-numbered invoice and files it under
 * invoices/<year>/<month>/.
 *
 * The invoice row is created by the `issue_invoice_on_approval` trigger, not here.
 * Numbering has to be transactional with the approval (a gap in the sequence is a
 * tax problem); rendering does not, and must never be able to fail an approval.
 * That split is why this function only ever *fills in* storage_path.
 */

const BRAND = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);
const RULE = rgb(0.88, 0.9, 0.92);

const SELLER = {
  name: Deno.env.get('INVOICE_SELLER_NAME') ?? 'KnowGraph',
  address: Deno.env.get('INVOICE_SELLER_ADDRESS') ?? '',
  email: Deno.env.get('INVOICE_SELLER_EMAIL') ?? 'mayurwaghchoure1995@gmail.com',
  taxId: Deno.env.get('INVOICE_SELLER_TAX_ID') ?? '',
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
  `${currency === 'INR' ? 'INR ' : 'EUR '}${amount.toFixed(2)}`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let invoiceId: string;
  try {
    ({ invoice_id: invoiceId } = await req.json());
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!invoiceId) return new Response('invoice_id is required', { status: 400 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .maybeSingle<Invoice>();

  if (error || !invoice) {
    return new Response(JSON.stringify({ error: 'invoice not found' }), { status: 404 });
  }

  const pdf = await renderInvoice(invoice);

  // Month-partitioned: a year-end export becomes a prefix list, not a table scan.
  const month = String(invoice.period_month).padStart(2, '0');
  const path = `${invoice.period_year}/${month}/${invoice.invoice_number}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(path, pdf, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    console.error('invoice upload failed', uploadError);
    return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 });
  }

  await supabase.from('invoices').update({ storage_path: path }).eq('id', invoice.id);

  return new Response(JSON.stringify({ ok: true, path }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

async function renderInvoice(invoice: Invoice): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width } = page.getSize();
  const left = 50;
  const right = width - 50;

  const text = (
    value: string,
    x: number,
    y: number,
    size = 10,
    useBold = false,
    color = BRAND
  ) => page.drawText(value, { x, y, size, font: useBold ? bold : font, color });

  const rightText = (value: string, y: number, size = 10, useBold = false, color = BRAND) => {
    const f = useBold ? bold : font;
    const w = f.widthOfTextAtSize(value, size);
    page.drawText(value, { x: right - w, y, size, font: f, color });
  };

  // Header band
  page.drawRectangle({ x: 0, y: 762, width, height: 80, color: BRAND });
  page.drawText('KnowGraph', {
    x: left,
    y: 795,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });
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

  if (invoice.billing_country) {
    text(`Country: ${invoice.billing_country}`, left, y, 10, false, MUTED);
  }
  rightText(
    invoice.region === 'india' ? 'Domestic (India)' : 'International',
    y,
    10,
    false,
    MUTED
  );

  // Seller
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

  // Line items
  y -= 46;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: RULE,
  });
  y -= 18;
  text('Description', left, y, 9, true, MUTED);
  rightText('Amount', y, 9, true, MUTED);
  y -= 10;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: RULE,
  });

  y -= 24;
  text(invoice.course_title, left, y, 11);
  rightText(money(invoice.amount, invoice.currency), y, 11);
  y -= 14;
  text('Course enrollment — lifetime access', left, y, 9, false, MUTED);

  y -= 26;
  page.drawLine({
    start: { x: left, y },
    end: { x: right, y },
    thickness: 1,
    color: RULE,
  });

  y -= 26;
  text('Total paid', left, y, 12, true);
  rightText(money(invoice.amount, invoice.currency), y, 14, true);

  // Footer
  page.drawLine({
    start: { x: left, y: 110 },
    end: { x: right, y: 110 },
    thickness: 1,
    color: RULE,
  });
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
