import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Ticket } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readSponsorCode, rememberSponsorCode, clearSponsorCode } from '@/lib/auth-navigation';
import { quoteSponsorshipCode, redeemSponsorshipCode, type SponsorshipQuote } from '@/lib/sponsorship-access';
import { payWithRazorpay } from '@/lib/razorpay';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES, INDIAN_STATES, regionForCountry } from '@/lib/countries';
import GoogleCourseSignIn from './GoogleCourseSignIn';

const money = (amount: number, currency: string) => new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'de-DE', { style: 'currency', currency }).format(amount);

export default function SponsorshipCheckout({ courseId, onComplete, initialCountry = 'IN' }: { courseId: string; onComplete: () => void | Promise<void>; initialCountry?: string }) {
  const { user, authUser, resendVerification } = useAuth();
  const [code, setCode] = useState(readSponsorCode);
  const [appliedCode, setAppliedCode] = useState('');
  const [quote, setQuote] = useState<SponsorshipQuote | null>(null);
  const [fullName, setFullName] = useState(authUser?.profile?.full_name || user?.user_metadata?.full_name || '');
  const [college, setCollege] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [completed, setCompleted] = useState(false);
  const [billingCountry, setBillingCountry] = useState(initialCountry);
  const [billingState, setBillingState] = useState('');
  const verified = !!user?.email_confirmed_at;
  const from = { pathname: `/courses/${courseId}` };

  const applyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setMessage(''); setQuote(null);
    const entered = code.trim();
    rememberSponsorCode(entered);
    try {
      const result = await quoteSponsorshipCode(entered, courseId, regionForCountry(billingCountry));
      setAppliedCode(entered); setQuote(result);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not apply this coupon. Please try again.'); }
    finally { setBusy(false); }
  };

  const completeFreeEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !quote || appliedCode !== code.trim() || !verified) return;
    if (Number(quote.discount_percent) < 100 && regionForCountry(billingCountry) === 'india' && !billingState) {
      setError('Select your billing state before opening secure payment.');
      return;
    }
    setBusy(true); setError('');
    try {
      if (Number(quote.discount_percent) === 100 && Number(quote.total) === 0) {
        await redeemSponsorshipCode(appliedCode, fullName, college);
      } else {
        const payment = await payWithRazorpay({ courseId, region: regionForCountry(billingCountry), billingCountry,
          billingState, couponCode: appliedCode, fullName, college, expectedAmountCents: Math.round(Number(quote.total) * 100), expectedCurrency: quote.currency });
        if (payment.status === 'cancelled') { setMessage('Checkout closed. Your course stays locked until payment is verified.'); return; }
        if (payment.status !== 'paid') throw new Error(payment.error || 'Payment could not be verified.');
        if (payment.paymentReviewRequired) setMessage('This payment was recorded for administrator review. Keep your payment reference.');
      }
      clearSponsorCode(); setCompleted(true);
      try { await onComplete(); }
      catch { setMessage('Enrollment is confirmed. Refresh your classroom to see the updated course access.'); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not complete free enrollment. Please check your invitation.'); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    if (!user?.email) return;
    setBusy(true); setError('');
    try {
      const result = await resendVerification(user.email, from.pathname);
      if (result.error) throw result.error;
      setMessage('Verification email sent. Confirm the link, then sign in with this same account.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not resend verification.'); }
    finally { setBusy(false); }
  };

  return <section className="space-y-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4" aria-label="Coupon checkout">
    <div><h3 className="flex items-center gap-2 font-semibold"><Ticket className="h-4 w-4" />Have a sponsorship coupon?</h3>
      <p className="mt-1 text-sm text-muted-foreground">Apply the code generated by KnowGraph and check your discount. aBAJA invitations cover 100%; other coupons may leave an amount to pay.</p></div>
    {completed ? <p className="flex items-center gap-2 text-sm" role="status"><CheckCircle2 className="h-4 w-4" />Enrollment complete. Your course access is available on web and in the app.</p> : !user ? (
      <div className="space-y-3 text-sm"><p>Use your own account on the website and mobile app. Verify your email after signup, or continue with Google.</p>
        <GoogleCourseSignIn returnTo={from.pathname} />
        <div className="flex flex-wrap gap-2"><Button size="sm" asChild><Link to="/login" state={{ from }}>Sign in to enroll</Link></Button>
          <Button size="sm" variant="outline" asChild><Link to="/signup" state={{ from }}>Create account</Link></Button></div></div>
    ) : !verified ? (
      <div className="space-y-3 text-sm"><p>Verify {user.email} before applying a coupon.</p><Button size="sm" variant="outline" onClick={resend} disabled={busy}>Resend verification email</Button></div>
    ) : <>
      <p className="break-all text-xs text-muted-foreground">Enrolling as {user.email}</p>
      <form onSubmit={applyCode} className="space-y-2"><Label htmlFor="checkout-coupon">Coupon code</Label>
        <Input id="checkout-coupon" value={code} disabled={busy} maxLength={128} autoComplete="off" autoCapitalize="characters" spellCheck={false}
          onChange={event => { setCode(event.target.value); setQuote(null); setError(''); }} placeholder="Code from KnowGraph or your team captain" required />
        <Label htmlFor="coupon-billing-country">Billing country</Label><Select value={billingCountry} disabled={busy} onValueChange={value => { setBillingCountry(value); setBillingState(''); setQuote(null); }}>
          <SelectTrigger id="coupon-billing-country"><SelectValue /></SelectTrigger><SelectContent className="max-h-64">{COUNTRIES.map(country => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}</SelectContent></Select>
        <Button type="submit" variant="outline" className="w-full" disabled={busy || !code.trim()}>{busy && !quote && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply coupon</Button></form>
      {quote && <form onSubmit={completeFreeEnrollment} className="space-y-4">
        <div className="space-y-2 rounded-lg border bg-background p-3 text-sm" aria-label="Order summary"><p className="font-medium">{quote.title}</p>
          <div className="flex justify-between"><span>Course price</span><span>{money(Number(quote.list_price), quote.currency)}</span></div>
          <div className="flex justify-between"><span>Coupon discount ({Number(quote.discount_percent)}%)</span><span>−{money(Number(quote.discount_amount), quote.currency)}</span></div>
          <div className="flex justify-between border-t pt-2 font-semibold"><span>Total to pay</span><span>{money(Number(quote.total), quote.currency)}</span></div>
          <p className="text-xs text-muted-foreground">{quote.campaign}{quote.team_name ? ` · ${quote.team_name}` : ''}</p></div>
        <div className="space-y-2"><Label htmlFor="checkout-name">Full name</Label><Input id="checkout-name" value={fullName} onChange={event => setFullName(event.target.value)} minLength={2} maxLength={160} required autoComplete="name" disabled={busy} /></div>
        <div className="space-y-2"><Label htmlFor="checkout-college">College or organization</Label><Input id="checkout-college" value={college} onChange={event => setCollege(event.target.value)} minLength={2} maxLength={200} required autoComplete="organization" disabled={busy} /></div>
        {Number(quote.discount_percent) < 100 && regionForCountry(billingCountry) === 'india' && <div className="space-y-2"><Label htmlFor="coupon-billing-state">Billing state</Label><Select value={billingState} disabled={busy} onValueChange={setBillingState}><SelectTrigger id="coupon-billing-state"><SelectValue placeholder="Select your state" /></SelectTrigger><SelectContent className="max-h-64">{INDIAN_STATES.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent></Select></div>}
        <p className="text-xs leading-relaxed text-muted-foreground">{Number(quote.discount_percent) === 100 ? 'Complete enrollment once to unlock all published courses, including future additions. You do not need to enter the code for each course. No card or payment is required.' : 'Pay the displayed balance securely with Razorpay. This discount applies to this course; access starts after payment is verified.'} Use this same account in the mobile app.</p>
        <Button type="submit" className="w-full" disabled={busy || appliedCode !== code.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{Number(quote.discount_percent) === 100 ? 'Complete free enrollment' : 'Continue secure payment'}</Button></form>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
