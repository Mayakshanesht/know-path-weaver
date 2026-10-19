import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), exchangeCodeForSession: vi.fn(), onAuthStateChange: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: mocks } }));

import AuthCallback from '@/pages/AuthCallback';

async function renderCallback(path: string) {
  window.history.replaceState(null, '', path);
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/sponsored-access" element={<p>Redeem sponsorship</p>} />
    <Route path="/home" element={<p>Course home</p>} />
  </Routes></MemoryRouter>);
  await act(async () => { await Promise.resolve(); });
}

describe('Google and email auth callbacks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sessionStorage.clear();
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'student-1' } } }, error: null });
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
    mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it('uses the SDK session without exchanging the same one-time code twice and resumes coupon activation', async () => {
    await renderCallback('/auth/callback?code=one-time-code&next=%2Fsponsored-access');
    expect(screen.getByText("You're signed in")).toBeInTheDocument();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Redeem sponsorship')).toBeInTheDocument();
  });

  it('rejects an external OAuth return destination', async () => {
    await renderCallback('/auth/callback?next=https%3A%2F%2Fexample.com');
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Course home')).toBeInTheDocument();
  });

  it('shows OAuth denial errors even without an error_description and removes callback credentials', async () => {
    await renderCallback('/auth/callback#error=access_denied');
    expect(screen.getByText('Could not complete sign-in')).toBeInTheDocument();
    expect(screen.getByText(/Google sign-in was cancelled/)).toBeInTheDocument();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('unsubscribes the delayed-session listener when the page is left', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await renderCallback('/auth/callback');
    expect(mocks.onAuthStateChange).toHaveBeenCalledOnce();
    cleanup();
    expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
});
