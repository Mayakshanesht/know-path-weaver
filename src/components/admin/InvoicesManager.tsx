import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Invoice } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useInvoiceDownload } from '@/hooks/useInvoiceDownload';
import { countryName } from '@/lib/countries';
import { Download, FileText, Clock, Loader2 } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const monthKey = (i: Invoice) => `${i.period_year}-${String(i.period_month).padStart(2, '0')}`;

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);

export default function InvoicesManager() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('all');
  const { toast } = useToast();
  const { download, downloadingId } = useInvoiceDownload();

  useEffect(() => {
    void fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .order('issued_at', { ascending: false });

    if (error) {
      toast({ title: 'Could not load invoices', description: error.message, variant: 'destructive' });
    } else {
      setInvoices((data ?? []) as Invoice[]);
    }
    setLoading(false);
  };

  const periods = useMemo(() => {
    const seen = new Set(invoices.map(monthKey));
    return [...seen].sort().reverse();
  }, [invoices]);

  const visible = useMemo(
    () => (period === 'all' ? invoices : invoices.filter((i) => monthKey(i) === period)),
    [invoices, period]
  );

  // Totals must stay split by currency: adding INR to EUR would be meaningless.
  const totals = useMemo(() => {
    const acc: Record<string, { count: number; amount: number }> = {};
    for (const invoice of visible) {
      const key = `${invoice.region}|${invoice.currency}`;
      acc[key] ??= { count: 0, amount: 0 };
      acc[key].count += 1;
      acc[key].amount += Number(invoice.amount);
    }
    return acc;
  }, [visible]);

  /**
   * Flips an invoice between India and international.
   *
   * Region is not cosmetic: it decides both the price charged (price_india vs
   * price_international) and the currency, so changing it must reprice the invoice —
   * and must discard the stored PDF, or the file on disk would keep showing the old
   * figure while the row says something else.
   *
   * Needed because the enrollments approved before checkout captured a country have no
   * region, and it cannot be recovered from the data.
   */
  const setRegion = async (invoice: Invoice, region: 'india' | 'international') => {
    if (region === invoice.region) return;

    const { data: course } = await supabase
      .from('courses')
      .select('price_india, price_international')
      .eq('id', invoice.course_id)
      .maybeSingle();

    const amount =
      region === 'india' ? (course?.price_india ?? 0) : (course?.price_international ?? 0);

    const { error } = await supabase
      .from('invoices')
      .update({
        region,
        amount,
        currency: region === 'india' ? 'INR' : 'EUR',
        storage_path: null, // force the PDF to re-render at the corrected figure
      })
      .eq('id', invoice.id);

    if (error) {
      toast({ title: 'Could not update', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Invoice repriced',
        description: `${invoice.invoice_number} is now ${region === 'india' ? 'INR' : 'EUR'} ${amount}.`,
      });
      await fetchInvoices();
    }
  };

  const exportCsv = () => {
    const header = [
      'invoice_number', 'issued_at', 'buyer_name', 'buyer_email',
      'course', 'country', 'region', 'currency', 'amount',
    ];
    const rows = visible.map((i) => [
      i.invoice_number,
      new Date(i.issued_at).toISOString().slice(0, 10),
      i.buyer_name ?? '',
      i.buyer_email ?? '',
      i.course_title,
      countryName(i.billing_country),
      i.region,
      i.currency,
      Number(i.amount).toFixed(2),
    ]);

    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowgraph-invoices-${period === 'all' ? 'all' : period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              {periods.map((p) => {
                const [year, month] = p.split('-');
                return (
                  <SelectItem key={p} value={p}>
                    {MONTHS[Number(month) - 1]} {year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {visible.length} invoice{visible.length === 1 ? '' : 's'}
          </span>
        </div>

        <Button variant="outline" onClick={exportCsv} disabled={visible.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Tax summary, split by region and currency */}
      {Object.keys(totals).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(totals).map(([key, { count, amount }]) => {
            const [region, currency] = key.split('|');
            return (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {region === 'india' ? 'India (domestic)' : 'International'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{formatMoney(amount, currency)}</p>
                  <p className="text-xs text-muted-foreground">
                    {count} invoice{count === 1 ? '' : 's'}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No invoices yet</p>
            <p className="text-sm text-muted-foreground">
              An invoice is issued automatically when you approve an enrollment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">
                      {invoice.invoice_number}
                    </span>
                    <Badge variant={invoice.region === 'india' ? 'secondary' : 'outline'}>
                      {countryName(invoice.billing_country)}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {invoice.buyer_name ?? invoice.buyer_email ?? 'Unknown'} — {invoice.course_title}
                  </p>
                </div>

                {/* Region drives price and currency, and the older enrollments have
                    none, so it has to be correctable. */}
                <Select
                  value={invoice.region}
                  onValueChange={(v) => setRegion(invoice, v as 'india' | 'international')}
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="india">India — INR</SelectItem>
                    <SelectItem value="international">International — EUR</SelectItem>
                  </SelectContent>
                </Select>

                <div className="text-right">
                  <p className="font-semibold">
                    {formatMoney(Number(invoice.amount), invoice.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(invoice.issued_at).toLocaleDateString()}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingId === invoice.id}
                  onClick={() => download(invoice.id)}
                  title="Downloads the PDF, rendering it if this is the first time"
                >
                  {downloadingId === invoice.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
