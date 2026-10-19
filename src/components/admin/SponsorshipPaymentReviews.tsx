import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface SponsorshipPaymentReview {
  id: string;
  user_id: string;
  course_id: string;
  enrollment_id: string | null;
  payment_reference: string;
  amount: number;
  currency: string;
  source: string;
  status: 'needs_review' | 'resolved';
  buyer_email: string | null;
  course_title: string | null;
  received_at: string;
  review_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
}

const resolveReview = supabase.rpc.bind(supabase) as unknown as (
  name: 'admin_resolve_sponsorship_payment_review',
  params: { p_review_id: string; p_notes: string },
) => PromiseLike<{ error: { message: string } | null }>;

function paymentAmount(review: SponsorshipPaymentReview): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: review.currency }).format(Number(review.amount));
  } catch {
    return `${review.currency} ${Number(review.amount).toFixed(2)}`;
  }
}

export default function SponsorshipPaymentReviews() {
  const [reviews, setReviews] = useState<SponsorshipPaymentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const all: SponsorshipPaymentReview[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('sponsorship_payment_reviews' as never).select('*')
          .order('received_at', { ascending: false }).order('id').range(offset, offset + 499);
        if (error) throw new Error(error.message);
        const page = (data ?? []) as unknown as SponsorshipPaymentReview[];
        all.push(...page);
        if (page.length < 500) break;
      }
      setReviews(all);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load payment reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const resolve = async (event: React.FormEvent, review: SponsorshipPaymentReview) => {
    event.preventDefault();
    setActionError('');
    setSuccess('');
    const resolutionNotes = (notes[review.id] ?? '').trim();
    if (!resolutionNotes || resolutionNotes.length > 2000) {
      setActionError('Describe the action taken in 1–2,000 characters before resolving this payment.');
      return;
    }
    setSavingId(review.id);
    try {
      const { error } = await resolveReview('admin_resolve_sponsorship_payment_review', { p_review_id: review.id, p_notes: resolutionNotes });
      if (error) throw new Error(error.message);
      setSuccess(`Payment ${review.payment_reference} marked as resolved. Your notes were saved.`);
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to resolve this payment. Your notes are still here; please retry.');
    } finally {
      setSavingId(null);
    }
  };

  const outstanding = reviews.filter((review) => review.status === 'needs_review');
  const resolved = reviews.filter((review) => review.status === 'resolved');
  const visible = showResolved ? [...outstanding, ...resolved] : outstanding;
  const unavailable = loading || !!loadError || !!savingId;

  return (
    <Card className={outstanding.length ? 'border-amber-500/50 bg-amber-500/5' : ''}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" />Payments needing reconciliation{!loading && !loadError && <Badge variant={outstanding.length ? 'destructive' : 'secondary'}>{outstanding.length} need review</Badge>}</CardTitle>
            <CardDescription>These payments need review because course access or another completed purchase already existed. Check the actual gateway or bank transaction and record the outcome. Earlier invoices and free-access receipts remain unchanged.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading || !!savingId}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh payment reviews</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">If a refund is needed, complete it in the payment gateway or bank first, then add its reference below. Marking a review as resolved only saves your notes; it does not issue a refund or collect money.</p>
        {loadError && <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">Payment reviews could not be loaded: {loadError}. Refresh to retry; the review count is unavailable.</div>}
        {actionError && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{actionError}</p>}
        {success && <p role="status" className="rounded-md border border-emerald-500/30 p-3 text-sm">{success}</p>}
        <Button size="sm" variant="outline" aria-pressed={showResolved} disabled={loading} onClick={() => setShowResolved((value) => !value)}>{showResolved ? 'Hide resolved reviews' : `Show resolved reviews (${resolved.length})`}</Button>
        {loading ? <p className="text-sm text-muted-foreground">Loading payment reviews…</p> : !loadError && !visible.length ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" />No payments need review.</p> : !loadError && visible.map((review) => (
          <div key={review.id} className="space-y-3 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="break-all font-medium">{review.buyer_email || review.user_id}</p><p className="text-sm text-muted-foreground">{review.course_title || review.course_id}</p></div>
              <div className="text-right"><p className="font-semibold">{paymentAmount(review)}</p><Badge variant={review.status === 'needs_review' ? 'destructive' : 'secondary'}>{review.status === 'needs_review' ? 'Needs review' : 'Resolved'}</Badge></div>
            </div>
            <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
              <div><dt className="inline text-muted-foreground">Payment reference: </dt><dd className="inline select-all break-all font-mono">{review.payment_reference}</dd></div>
              <div><dt className="inline text-muted-foreground">Source: </dt><dd className="inline">{review.source}</dd></div>
              <div><dt className="inline text-muted-foreground">Received: </dt><dd className="inline">{new Date(review.received_at).toLocaleString()}</dd></div>
            </dl>
            {review.status === 'resolved' ? <div className="space-y-1 text-sm"><p className="whitespace-pre-wrap break-words">{review.review_notes}</p><p className="text-xs text-muted-foreground">Resolved {review.resolved_at ? new Date(review.resolved_at).toLocaleString() : ''}{review.resolved_by ? ` · administrator ${review.resolved_by}` : ''}</p></div> : (
              <form className="space-y-2" onSubmit={(event) => void resolve(event, review)}>
                <Label htmlFor={`payment-resolution-${review.id}`}>Resolution notes for {review.payment_reference}</Label>
                <Textarea id={`payment-resolution-${review.id}`} rows={2} maxLength={2000} required disabled={unavailable} value={notes[review.id] ?? ''} onChange={(event) => setNotes((previous) => ({ ...previous, [review.id]: event.target.value }))} placeholder="Action completed, gateway/bank reference, date, and any follow-up" />
                <Button size="sm" type="submit" disabled={unavailable || !(notes[review.id] ?? '').trim()}>{savingId === review.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark as resolved</Button>
              </form>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
