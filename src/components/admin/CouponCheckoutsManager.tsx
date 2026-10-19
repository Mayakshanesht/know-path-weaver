import { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sponsorshipCsv } from '@/lib/sponsorshipAdmin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type CheckoutStatus = 'pending' | 'paid' | 'needs_review';
interface CouponCheckout {
  id: string;
  redemption_id: string;
  user_id: string;
  course_id: string;
  course_title: string;
  buyer_name: string;
  buyer_email: string;
  coupon_code: string;
  sponsorship_campaign: string;
  team_name: string | null;
  list_price: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  currency: 'INR' | 'EUR';
  billing_region: string;
  billing_country: string | null;
  billing_state: string | null;
  status: CheckoutStatus;
  gateway_order_id: string | null;
  payment_reference: string | null;
  enrollment_id: string | null;
  created_at: string;
  paid_at: string | null;
}

const statusLabel: Record<CheckoutStatus, string> = { pending: 'Pending payment', paid: 'Paid', needs_review: 'Needs review' };
const money = (amount: number, currency: string) => new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'de-DE', { style: 'currency', currency }).format(Number(amount));

export default function CouponCheckoutsManager() {
  const [checkouts, setCheckouts] = useState<CouponCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CheckoutStatus | 'all'>('all');

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const all: CouponCheckout[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error: loadError } = await supabase.from('coupon_checkouts' as never).select('*')
          .order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
        if (loadError) throw new Error(loadError.message);
        const page = (data ?? []) as unknown as CouponCheckout[];
        all.push(...page);
        if (page.length < 500) break;
      }
      setCheckouts(all);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to load coupon checkouts.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visible = checkouts.filter((checkout) => (status === 'all' || checkout.status === status)
    && [checkout.buyer_name, checkout.buyer_email, checkout.course_title, checkout.coupon_code, checkout.sponsorship_campaign,
      checkout.team_name, checkout.gateway_order_id, checkout.payment_reference].join(' ').toLowerCase().includes(search.toLowerCase()));
  const pending = checkouts.filter((checkout) => checkout.status === 'pending');

  const exportCsv = () => {
    const rows: unknown[][] = [
      ['checkout_id', 'redemption_id', 'user_id', 'buyer_name', 'buyer_email', 'course_id', 'course_title', 'team', 'campaign', 'coupon_code',
        'list_price', 'discount_percent', 'discount_amount', 'total', 'currency', 'status', 'gateway_order_id', 'payment_reference', 'enrollment_id',
        'created_at', 'paid_at', 'billing_region', 'billing_country', 'billing_state'],
      ...visible.map((checkout) => [checkout.id, checkout.redemption_id, checkout.user_id, checkout.buyer_name, checkout.buyer_email,
        checkout.course_id, checkout.course_title, checkout.team_name, checkout.sponsorship_campaign, checkout.coupon_code,
        Number(checkout.list_price).toFixed(2), checkout.discount_percent, Number(checkout.discount_amount).toFixed(2), Number(checkout.total).toFixed(2),
        checkout.currency, checkout.status, checkout.gateway_order_id, checkout.payment_reference, checkout.enrollment_id,
        checkout.created_at, checkout.paid_at, checkout.billing_region, checkout.billing_country, checkout.billing_state]),
    ];
    const url = URL.createObjectURL(new Blob(['\uFEFF', sponsorshipCsv(rows)], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'knowgraph-coupon-checkouts.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  return <Card>
    <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" />Partial coupon checkouts</CardTitle><CardDescription className="mt-2">Track reserved coupon seats separately from completed enrollments. A pending checkout reserves the participant's seat but grants no course access.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh coupon checkouts</Button></div></CardHeader>
    <CardContent className="space-y-4">
      {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">Coupon checkouts could not be loaded: {error}. Counts are unavailable; refresh to retry.</p>}
      <div className="grid gap-3 sm:grid-cols-3">{(['pending', 'paid', 'needs_review'] as const).map((value) => <div key={value} className={`rounded-lg border p-4 ${value === 'needs_review' && checkouts.some((checkout) => checkout.status === value) ? 'border-amber-500/50 bg-amber-500/5' : ''}`}><p className="text-sm text-muted-foreground">{statusLabel[value]}</p><p className="mt-1 text-2xl font-semibold">{loading ? '…' : error ? 'Unavailable' : checkouts.filter((checkout) => checkout.status === value).length}</p></div>)}</div>
      {!loading && !error && <p className="text-sm text-muted-foreground">{new Set(pending.map((checkout) => checkout.user_id)).size} participant{new Set(pending.map((checkout) => checkout.user_id)).size === 1 ? '' : 's'} with a pending checkout. Multiple course checkouts can belong to the same participant seat.</p>}
      <p className="text-sm text-muted-foreground">Paid means the remaining balance was verified and the purchased course enrolled. Needs review means money was received but needs administrator reconciliation; inspect payment reviews in Invoices. A reservation alone is not revenue.</p>
      <div className="flex flex-wrap items-center gap-2">{(['all', 'pending', 'paid', 'needs_review'] as const).map((value) => <Button key={value} size="sm" variant={status === value ? 'default' : 'outline'} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === 'all' ? 'All checkouts' : statusLabel[value]}</Button>)}</div>
      <div className="flex flex-wrap gap-3"><Input className="min-w-48 flex-1" aria-label="Search coupon checkouts" placeholder="Search participant, team, course, coupon, or payment reference" value={search} onChange={(event) => setSearch(event.target.value)} /><Button variant="outline" disabled={loading || !!error || !visible.length} onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Export checkouts CSV</Button></div>
      <p className="text-xs text-muted-foreground">This export contains participant information and private invitation codes. Keep it within the administration team.</p>
      <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Participant / course</TableHead><TableHead>Coupon</TableHead><TableHead>Price snapshot</TableHead><TableHead>Status / dates</TableHead><TableHead>Gateway references</TableHead></TableRow></TableHeader><TableBody>
        {loading ? <TableRow><TableCell colSpan={5}>Loading coupon checkouts…</TableCell></TableRow> : error ? <TableRow><TableCell colSpan={5}>Checkout records unavailable.</TableCell></TableRow> : !visible.length ? <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No coupon checkouts match these filters.</TableCell></TableRow> : visible.map((checkout) => <TableRow key={checkout.id}>
          <TableCell><p className="font-medium">{checkout.buyer_name}</p><p className="text-xs text-muted-foreground">{checkout.buyer_email}</p><p className="mt-1 text-sm">{checkout.course_title}</p><p className="text-xs text-muted-foreground">{checkout.team_name || 'No assigned team'}</p></TableCell>
          <TableCell><p className="text-sm">{checkout.sponsorship_campaign}</p><code className="select-all break-all text-xs">{checkout.coupon_code}</code><p className="mt-1 text-xs text-muted-foreground">{checkout.discount_percent}% discount</p></TableCell>
          <TableCell className="whitespace-nowrap text-xs"><p>List: {money(checkout.list_price, checkout.currency)}</p><p>Discount: −{money(checkout.discount_amount, checkout.currency)}</p><p className="mt-1 font-semibold">{checkout.status === 'pending' ? 'Balance' : 'Received'}: {money(checkout.total, checkout.currency)}</p></TableCell>
          <TableCell><Badge variant={checkout.status === 'needs_review' ? 'destructive' : checkout.status === 'paid' ? 'default' : 'secondary'}>{statusLabel[checkout.status]}</Badge><p className="mt-2 text-xs text-muted-foreground">Created {new Date(checkout.created_at).toLocaleString()}</p>{checkout.paid_at && <p className="text-xs text-muted-foreground">Payment {new Date(checkout.paid_at).toLocaleString()}</p>}</TableCell>
          <TableCell className="max-w-56"><p className="select-all break-all font-mono text-xs">{checkout.gateway_order_id || 'Order not created'}</p><p className="mt-2 select-all break-all font-mono text-xs">{checkout.payment_reference || 'No verified payment'}</p></TableCell>
        </TableRow>)}
      </TableBody></Table></div>
    </CardContent>
  </Card>;
}
