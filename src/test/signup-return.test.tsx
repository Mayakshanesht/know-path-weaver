import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(), signIn: vi.fn(), signInWithGoogle: vi.fn(), resendVerification: vi.fn(), checkLegacyAccount: vi.fn(), migrateLegacyAccount: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, ...mocks }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import Signup from '@/pages/Signup';
import Login from '@/pages/Login';
import { readAuthReturn, rememberSponsorCode } from '@/lib/auth-navigation';

const destination = '/courses/course-under-review';
function LoginDestination() {
  const location = useLocation();
  return <p>Sign-in destination: {location.state?.from?.pathname}</p>;
}
function renderSignup() {
  return render(<MemoryRouter initialEntries={[{ pathname: '/signup', state: { from: { pathname: destination } } }]}><Routes>
    <Route path="/signup" element={<Signup />} />
    <Route path="/login" element={<LoginDestination />} />
  </Routes></MemoryRouter>);
}
function CurrentDestination() {
  const location = useLocation();
  return <p>Returned to {location.pathname}{location.search}</p>;
}
function renderLogin(from: { pathname: string; search?: string } = { pathname: destination }) {
  return render(<MemoryRouter initialEntries={[{ pathname: '/login', state: { from } }]}><Routes>
    <Route path="/login" element={<Login />} />
    <Route path={destination} element={<p>Requested course checkout</p>} />
    <Route path="/admin" element={<CurrentDestination />} />
  </Routes></MemoryRouter>);
}

describe('course checkout account creation and return', () => {
  beforeEach(() => {
    cleanup(); sessionStorage.clear(); vi.clearAllMocks();
    mocks.signUp.mockResolvedValue({ error: null });
    mocks.signIn.mockResolvedValue({ error: null });
    mocks.signInWithGoogle.mockResolvedValue({ error: null });
    mocks.resendVerification.mockResolvedValue({ error: null });
    mocks.checkLegacyAccount.mockResolvedValue({ found: false });
  });

  it('carries the selected course into signup verification and the subsequent sign-in link', async () => {
    renderSignup();
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Student One' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Secure123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Check Your Email!')).toBeInTheDocument();
    expect(mocks.signUp).toHaveBeenCalledWith('student@example.com', 'Secure123!', 'Student One', destination);
    expect(readAuthReturn()).toBe(destination);
    fireEvent.click(screen.getByRole('button', { name: 'Go to Sign In' }));
    expect(screen.getByText(`Sign-in destination: ${destination}`)).toBeInTheDocument();
  });

  it('returns Google signup to the selected course without claiming a coupon', async () => {
    rememberSponsorCode('PRIVATE-CODE');
    renderSignup();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mocks.signInWithGoogle).toHaveBeenCalledWith(destination));
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('returns email login with a saved coupon to the requested course', async () => {
    rememberSponsorCode('PRIVATE-CODE');
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Secure123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Requested course checkout')).toBeInTheDocument();
    expect(mocks.signIn).toHaveBeenCalledWith('student@example.com', 'Secure123!');
  });

  it('keeps the requested course in a resent verification email', async () => {
    mocks.signIn.mockResolvedValue({ error: { code: 'email_not_confirmed', message: 'Email not confirmed' } });
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Secure123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Resend verification email' }));
    await waitFor(() => expect(mocks.resendVerification).toHaveBeenCalledWith('student@example.com', destination));
  });

  it('returns email login to the requested admin coupon tab', async () => {
    renderLogin({ pathname: '/admin', search: '?tab=sponsorship' });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Secure123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Returned to /admin?tab=sponsorship')).toBeInTheDocument();
  });

  it('preserves the requested admin coupon tab for Google sign-in', async () => {
    renderLogin({ pathname: '/admin', search: '?tab=sponsorship' });
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mocks.signInWithGoogle).toHaveBeenCalledWith('/admin?tab=sponsorship'));
  });
});
