import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), onComplete: vi.fn(), resendVerification: vi.fn(),
  auth: { user: { email: 'student@example.com', email_confirmed_at: '2026-10-19T10:00:00Z', user_metadata: { full_name: 'Ada Student' } }, authUser: null } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/razorpay', () => ({ payWithRazorpay: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ ...mocks.auth, resendVerification: mocks.resendVerification }) }));
import SponsorshipCheckout from '@/components/courses/SponsorshipCheckout';
import SponsoredAccess from '@/pages/SponsoredAccess';
import { readSponsorCode } from '@/lib/auth-navigation';
import { payWithRazorpay } from '@/lib/razorpay';

const quote = { course_id: 'course-1', title: 'Engineering course', list_price: 14999, discount_amount: 14999, total: 0, discount_percent: 100, currency: 'INR', campaign: 'SAEINDIA 2027 aBAJA', team_name: 'Team One', already_redeemed: false };
function renderCheckout(initialCountry = 'IN') { return render(<MemoryRouter><SponsorshipCheckout courseId="course-1" initialCountry={initialCountry} onComplete={mocks.onComplete} /></MemoryRouter>); }
async function applyCode(button = 'Complete free enrollment') {
  fireEvent.change(screen.getByLabelText('Coupon code'), { target: { value: 'PRIVATE-CODE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply coupon' }));
  await screen.findByRole('button', { name: button });
}

describe('course-page coupon checkout', () => {
  beforeEach(() => {
    cleanup(); sessionStorage.clear(); vi.clearAllMocks();
    mocks.auth.user.email_confirmed_at = '2026-10-19T10:00:00Z';
    mocks.onComplete.mockResolvedValue(undefined);
    mocks.resendVerification.mockResolvedValue({ error: null });
    mocks.rpc.mockImplementation(async name => name === 'quote_sponsorship_code'
      ? { data: quote, error: null }
      : { data: { redemption_id: 'redemption-1', enrolled_count: 6, already_redeemed: false }, error: null });
  });
  it('previews a zero total without taking a seat and enrolls only after explicit confirmation', async () => {
    renderCheckout(); await applyCode();
    expect(screen.getByLabelText('Order summary')).toHaveTextContent('100%');
    expect(screen.getByLabelText('Order summary')).toHaveTextContent('₹0.00');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith('quote_sponsorship_code', { p_code: 'PRIVATE-CODE', p_course_id: 'course-1', p_region: 'india' });
    fireEvent.change(screen.getByLabelText('College or organization'), { target: { value: 'Example College' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete free enrollment' }));
    expect(await screen.findByText(/Enrollment complete/)).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenLastCalledWith('redeem_sponsorship_code', { p_code: 'PRIVATE-CODE', p_full_name: 'Ada Student', p_college: 'Example College' });
    expect(mocks.onComplete).toHaveBeenCalledOnce(); expect(readSponsorCode()).toBe('');
  });
  it('keeps access locked and the invitation available if the last seat is taken before completion', async () => {
    renderCheckout(); await applyCode();
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'All seats have now been claimed.' } });
    fireEvent.change(screen.getByLabelText('College or organization'), { target: { value: 'Example College' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete free enrollment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('All seats');
    expect(readSponsorCode()).toBe('PRIVATE-CODE'); expect(mocks.onComplete).not.toHaveBeenCalled();
  });
  it('requires email verification before a coupon can be quoted', () => {
    mocks.auth.user.email_confirmed_at = '';
    renderCheckout();
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Apply coupon' })).not.toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('discards the displayed zero-price quote when its code changes', async () => {
    renderCheckout(); await applyCode();
    fireEvent.change(screen.getByLabelText('Coupon code'), { target: { value: 'OTHER-CODE' } });
    expect(screen.queryByRole('button', { name: 'Complete free enrollment' })).not.toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it('rejects an unexpected nonzero or mismatched quote rather than displaying free checkout', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...quote, total: 999 }, error: null });
    renderCheckout();
    fireEvent.change(screen.getByLabelText('Coupon code'), { target: { value: 'PRIVATE-CODE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply coupon' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not confirm this discount');
    expect(screen.queryByRole('button', { name: 'Complete free enrollment' })).not.toBeInTheDocument();
  });
  it('does not redeem an invitation from the orientation page', () => {
    render(<MemoryRouter><SponsoredAccess /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Choose a course' })).toHaveAttribute('href', '/courses');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('rejects a missing discount amount instead of showing an invalid checkout', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...quote, discount_amount: undefined }, error: null });
    renderCheckout();
    fireEvent.change(screen.getByLabelText('Coupon code'), { target: { value: 'PRIVATE-CODE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply coupon' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not confirm this discount');
    expect(screen.queryByRole('button', { name: 'Complete free enrollment' })).not.toBeInTheDocument();
  });
  it('sends only the remaining balance through secure checkout for a partial coupon', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...quote, discount_percent: 25,
      discount_amount: 3749.75, total: 11249.25, currency: 'EUR' }, error: null });
    vi.mocked(payWithRazorpay).mockResolvedValue({ status: 'paid' });
    renderCheckout('US'); await applyCode('Continue secure payment');
    expect(screen.queryByRole('button', { name: 'Complete free enrollment' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('College or organization'), { target: { value: 'Example College' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue secure payment' }));
    expect(await screen.findByText(/Enrollment complete/)).toBeInTheDocument();
    expect(payWithRazorpay).toHaveBeenCalledWith(expect.objectContaining({ couponCode: 'PRIVATE-CODE',
      courseId: 'course-1', expectedAmountCents: 1124925, expectedCurrency: 'EUR', region: 'international' }));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.onComplete).toHaveBeenCalledOnce();
  });
  it('does not unlock a course when discounted payment is cancelled', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...quote, discount_percent: 25,
      discount_amount: 3749.75, total: 11249.25, currency: 'EUR' }, error: null });
    vi.mocked(payWithRazorpay).mockResolvedValue({ status: 'cancelled' });
    renderCheckout('US'); await applyCode('Continue secure payment');
    fireEvent.change(screen.getByLabelText('College or organization'), { target: { value: 'Example College' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue secure payment' }));
    expect(await screen.findByRole('status')).toHaveTextContent('stays locked');
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.onComplete).not.toHaveBeenCalled();
  });
});
