import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), range: vi.fn(), toast: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: mocks.rpc,
  from: () => ({ select: () => ({ order: () => ({ order: () => ({ range: mocks.range }) }) }) }),
} }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

import SponsorshipManager from '@/components/admin/SponsorshipManager';
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

describe('admin percentage coupon creation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });
  beforeEach(() => {
    cleanup(); vi.clearAllMocks();
    let nextId = 0;
    vi.stubGlobal('crypto', { randomUUID: () => `request-${++nextId}` });
    mocks.range.mockResolvedValue({ data: [], error: null });
    mocks.rpc.mockImplementation(async (_name, params) => ({ data: {
      id: params.p_request_id, code: `AB27-SERVER-${params.p_request_id}`, label: params.p_label,
      campaign: params.p_campaign, audience: params.p_audience, team_name: params.p_team_name,
      max_redemptions: params.p_max_redemptions, allowed_emails: params.p_allowed_emails,
      expires_at: params.p_expires_at, discount_percent: params.p_discount_percent, active: true,
    }, error: null }));
  });

  it('defaults to 100% and submits the chosen percentage while letting the database generate the code', async () => {
    render(<SponsorshipManager />);
    const button = await screen.findByRole('button', { name: 'Generate coupon' });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByLabelText('Discount (%)')).toHaveValue(100);
    expect(screen.getByLabelText('Members')).toHaveValue(35);
    expect(screen.queryByLabelText('Campaign')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Team CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Participant tracking')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'Racing Team' } });
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '25.5' } });
    fireEvent.click(button);
    expect(await screen.findByText('AB27-SERVER-request-1')).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith('admin_create_sponsorship_code', expect.objectContaining({ p_label: 'Racing Team', p_campaign: 'SAEINDIA 2027 aBAJA', p_discount_percent: 25.5, p_max_redemptions: 35, p_team_name: 'Racing Team', p_request_id: 'request-1' }));
    const params = mocks.rpc.mock.calls[0][1];
    expect(params).not.toHaveProperty('code');
    expect(params).not.toHaveProperty('p_code');
    expect(screen.getByText('25.5% discount')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy instructions' })).toBeInTheDocument();
  });

  it('previews and creates mixed bulk percentages with the selected default for blank cells', async () => {
    render(<SponsorshipManager />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate coupon' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Discount (%)'), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bulk import' }));
    fireEvent.change(screen.getByLabelText('Team CSV'), { target: { value: 'label,team_name,seats,discount_percent\nTeam 01,First,5,\nTeam 02,Second,10,25.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Validate and preview teams' }));
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25.5%')).toBeInTheDocument();
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create 2 team codes' }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
    expect(mocks.rpc.mock.calls.map(([, params]) => params.p_discount_percent)).toEqual([75, 25.5]);
    expect(mocks.rpc.mock.calls.map(([, params]) => params.p_request_id)).toEqual(['request-1', 'request-2']);
  });

  it('keeps email restrictions, deadline and optional naming together under Advanced options', async () => {
    render(<SponsorshipManager />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate coupon' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'Falcon Racing' } });
    fireEvent.click(screen.getByRole('button', { name: /Advanced options/ }));
    fireEvent.change(screen.getByLabelText('Custom label (optional)'), { target: { value: 'Team 01' } });
    fireEvent.change(screen.getByLabelText('Allowed account emails (optional)'), { target: { value: ' MEMBER@College.edu ' } });
    const deadline = '2099-12-31T12:00';
    fireEvent.change(screen.getByLabelText('Claim deadline (optional)'), { target: { value: deadline } });
    fireEvent.click(screen.getByRole('button', { name: /Advanced options/ }));
    expect(screen.getByRole('button', { name: /Advanced options.*1 allowed email.*Deadline set/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Campaign')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate coupon' }));
    await screen.findByText('AB27-SERVER-request-1');
    expect(mocks.rpc).toHaveBeenCalledWith('admin_create_sponsorship_code', expect.objectContaining({
      p_label: 'Team 01', p_team_name: 'Falcon Racing', p_allowed_emails: ['member@college.edu'], p_expires_at: new Date(deadline).toISOString(),
    }));
  });

  it('requires the individual recipient email in the main form and fixes the member count at one', async () => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<SponsorshipManager />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate coupon' })).toBeEnabled());
    fireEvent.keyDown(screen.getByLabelText('Coupon for'), { key: 'ArrowDown' });
    fireEvent.keyDown(await screen.findByRole('option', { name: 'Individual' }), { key: 'Enter' });
    expect(screen.getByLabelText('Recipient account email')).toBeRequired();
    expect(screen.getByLabelText('Members')).toHaveValue(1);
    expect(screen.getByLabelText('Members')).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: 'Generate coupon' }));
    expect(mocks.rpc).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Recipient account email'), { target: { value: 'learner@college.edu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate coupon' }));
    await screen.findByText('AB27-SERVER-request-1');
    expect(mocks.rpc).toHaveBeenCalledWith('admin_create_sponsorship_code', expect.objectContaining({
      p_label: 'learner@college.edu', p_audience: 'individual', p_max_redemptions: 1,
      p_allowed_emails: ['learner@college.edu'], p_team_name: null,
    }));
  });

  it('retries a failed simple-form request with the same idempotency key', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Connection interrupted' } });
    render(<SponsorshipManager />);
    const button = await screen.findByRole('button', { name: 'Generate coupon' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'Stable Request Team' } });
    fireEvent.click(button);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Could not create the code' })));
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await screen.findByText('AB27-SERVER-request-1');
    expect(mocks.rpc.mock.calls.map(([, params]) => params.p_request_id)).toEqual(['request-1', 'request-1']);
  });
});
