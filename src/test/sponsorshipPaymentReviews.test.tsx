import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), range: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ order: () => ({ order: () => ({ range: mocks.range }) }) }) }),
  },
}));

import SponsorshipPaymentReviews from '@/components/admin/SponsorshipPaymentReviews';

const payment = {
  id: 'review-1', user_id: 'student-1', course_id: 'course-1', enrollment_id: 'enrollment-1',
  payment_reference: 'pay_real_123', amount: 1999, currency: 'INR', source: 'razorpay-verify',
  status: 'needs_review', buyer_email: 'student@example.com', course_title: 'Vehicle dynamics',
  received_at: '2026-10-19T10:00:00Z', review_notes: null, resolved_by: null, resolved_at: null,
};

describe('late sponsorship payment reviews', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.range.mockResolvedValue({ data: [payment], error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('shows real payments prominently and requires notes before an administrator can resolve them', async () => {
    render(<SponsorshipPaymentReviews />);
    expect(await screen.findByText('student@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 need review')).toBeInTheDocument();
    expect(screen.getByText('pay_real_123')).toBeInTheDocument();
    expect(screen.getByText(/does not issue a refund or collect money/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark as resolved' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Resolution notes for pay_real_123'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Mark as resolved' })).toBeDisabled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('saves the completed action through the admin RPC and keeps resolved records available', async () => {
    render(<SponsorshipPaymentReviews />);
    const notes = await screen.findByLabelText('Resolution notes for pay_real_123');
    mocks.range.mockResolvedValue({ data: [{ ...payment, status: 'resolved', review_notes: 'Refund completed: rfnd_123', resolved_by: 'admin-1', resolved_at: '2026-10-19T12:00:00Z' }], error: null });
    fireEvent.change(notes, { target: { value: '  Refund completed: rfnd_123  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as resolved' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('admin_resolve_sponsorship_payment_review', { p_review_id: 'review-1', p_notes: 'Refund completed: rfnd_123' }));
    expect(await screen.findByText('No payments need review.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show resolved reviews (1)' }));
    expect(screen.getByText('Refund completed: rfnd_123')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('retains notes and the outstanding review when the server rejects resolution', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Only administrators can resolve payment reviews.' } });
    render(<SponsorshipPaymentReviews />);
    const notes = await screen.findByLabelText('Resolution notes for pay_real_123');
    fireEvent.change(notes, { target: { value: 'Checked payment and refunded rfnd_123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as resolved' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Only administrators');
    expect(notes).toHaveValue('Checked payment and refunded rfnd_123');
    expect(screen.getByText('Needs review')).toBeInTheDocument();
  });

  it('reports loading failures instead of reporting that no payments need review', async () => {
    mocks.range.mockResolvedValue({ data: null, error: { message: 'Connection unavailable' } });
    render(<SponsorshipPaymentReviews />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable');
    expect(screen.queryByText('No payments need review.')).not.toBeInTheDocument();
    expect(screen.queryByText('0 need review')).not.toBeInTheDocument();
  });

  it('fetches subsequent pages so a payment after the first 500 records is still actionable', async () => {
    const historical = Array.from({ length: 500 }, (_, index) => ({ ...payment, id: `resolved-${index}`, status: 'resolved', review_notes: 'Previously reconciled' }));
    mocks.range.mockResolvedValueOnce({ data: historical, error: null }).mockResolvedValueOnce({ data: [payment], error: null });
    render(<SponsorshipPaymentReviews />);
    expect(await screen.findByText('student@example.com')).toBeInTheDocument();
    expect(screen.getByText('1 need review')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show resolved reviews (500)' })).toBeInTheDocument();
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(mocks.range).toHaveBeenNthCalledWith(2, 500, 999);
  });
});
