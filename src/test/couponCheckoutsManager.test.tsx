import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ from: vi.fn(), range: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
import CouponCheckoutsManager from '@/components/admin/CouponCheckoutsManager';

const checkout = {
  id: 'checkout-1', redemption_id: 'claim-1', user_id: 'student-1', course_id: 'course-1', course_title: 'Vehicle dynamics',
  buyer_name: 'Student One', buyer_email: 'student@example.com', coupon_code: 'PRIVATE-25', sponsorship_campaign: 'Community learning',
  team_name: 'Racing Team', list_price: 2000, discount_percent: 25, discount_amount: 500, total: 1500, currency: 'INR',
  billing_region: 'india', billing_country: 'IN', billing_state: 'Maharashtra', status: 'pending', gateway_order_id: 'order_1',
  payment_reference: null, enrollment_id: null, created_at: '2026-10-19T10:00:00Z', paid_at: null,
};

describe('admin partial coupon checkout tracking', () => {
  beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    mocks.from.mockImplementation(() => ({ select: () => ({ order: () => ({ order: () => ({ range: mocks.range }) }) }) }));
    mocks.range.mockResolvedValue({ data: [checkout], error: null });
  });

  it('shows an unpaid reservation as a balance and explicitly says it grants no access or revenue', async () => {
    render(<CouponCheckoutsManager />);
    expect(await screen.findByText('Student One')).toBeInTheDocument();
    expect(screen.getByText(/A pending checkout reserves the participant/)).toHaveTextContent('grants no course access');
    expect(screen.getByText(/A reservation alone is not revenue/)).toBeInTheDocument();
    expect(screen.getByText('Balance: ₹1,500.00')).toBeInTheDocument();
    expect(screen.getByText('25% discount')).toBeInTheDocument();
    expect(screen.getByText('No verified payment')).toBeInTheDocument();
    expect(screen.getByText(/1 participant with a pending checkout/)).toBeInTheDocument();
    expect(mocks.from).toHaveBeenCalledWith('coupon_checkouts');
  });

  it('filters completed and review payments separately without offering payment mutations', async () => {
    mocks.range.mockResolvedValue({ data: [checkout,
      { ...checkout, id: 'checkout-2', status: 'paid', buyer_name: 'Paid Student', payment_reference: 'pay_complete', paid_at: '2026-10-19T11:00:00Z' },
      { ...checkout, id: 'checkout-3', status: 'needs_review', buyer_name: 'Review Student', payment_reference: 'pay_review', paid_at: '2026-10-19T12:00:00Z' },
    ], error: null });
    render(<CouponCheckoutsManager />);
    await screen.findByText('Paid Student');
    fireEvent.click(screen.getByRole('button', { name: 'Needs review' }));
    expect(screen.getByText('Review Student')).toBeInTheDocument();
    expect(screen.getByText('pay_review')).toBeInTheDocument();
    expect(screen.queryByText('Paid Student')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refund|resolve|approve/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All checkouts' }));
    fireEvent.change(screen.getByLabelText('Search coupon checkouts'), { target: { value: 'pay_complete' } });
    expect(screen.getByText('Paid Student')).toBeInTheDocument();
    expect(screen.queryByText('Review Student')).not.toBeInTheDocument();
  });

  it('keeps counts unavailable and export disabled after a load failure, then supports refresh', async () => {
    mocks.range.mockResolvedValueOnce({ data: null, error: { message: 'Connection unavailable' } });
    render(<CouponCheckoutsManager />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable');
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Export checkouts CSV' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh coupon checkouts' }));
    expect(await screen.findByText('Student One')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('loads later pages and counts pending participants distinctly from their course checkouts', async () => {
    mocks.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, index) => ({ ...checkout, id: `paid-${index}`, status: 'paid' })), error: null })
      .mockResolvedValueOnce({ data: [checkout, { ...checkout, id: 'checkout-2', course_id: 'course-2', course_title: 'Motion planning' }], error: null });
    render(<CouponCheckoutsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Pending payment' }));
    expect(await screen.findByText('Motion planning')).toBeInTheDocument();
    expect(screen.getByText(/1 participant with a pending checkout/)).toBeInTheDocument();
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(mocks.range).toHaveBeenNthCalledWith(2, 500, 999);
  });
});
