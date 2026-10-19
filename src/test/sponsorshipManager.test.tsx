import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), range: vi.fn(), toast: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: mocks.rpc,
  from: () => ({ select: () => ({ order: () => ({ order: () => ({ range: mocks.range }) }) }) }),
} }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));

import SponsorshipManager from '@/components/admin/SponsorshipManager';

describe('admin percentage coupon creation', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
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
    const button = await screen.findByRole('button', { name: 'Generate coupon code' });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByLabelText('Discount percentage')).toHaveValue(100);
    fireEvent.change(screen.getByLabelText('Invitation label'), { target: { value: 'Team 01' } });
    fireEvent.change(screen.getByLabelText('Team / committee name (required)'), { target: { value: 'Racing Team' } });
    fireEvent.change(screen.getByLabelText('Discount percentage'), { target: { value: '25.5' } });
    fireEvent.click(button);
    expect(await screen.findByText('AB27-SERVER-request-1')).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith('admin_create_sponsorship_code', expect.objectContaining({ p_discount_percent: 25.5, p_max_redemptions: 35, p_team_name: 'Racing Team', p_request_id: 'request-1' }));
    const params = mocks.rpc.mock.calls[0][1];
    expect(params).not.toHaveProperty('code');
    expect(params).not.toHaveProperty('p_code');
    expect(screen.getByText('25.5% discount')).toBeInTheDocument();
  });

  it('previews and creates mixed bulk percentages with the selected default for blank cells', async () => {
    render(<SponsorshipManager />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate coupon code' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Discount percentage'), { target: { value: '75' } });
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
});
