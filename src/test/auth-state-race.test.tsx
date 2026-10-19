import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const mocks = vi.hoisted(() => ({ callback: null as null | ((event: string, session: unknown) => void), profile: new Map(), roles: new Map(), initialSession: null as unknown }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    onAuthStateChange: (callback: typeof mocks.callback) => { mocks.callback = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
    getSession: async () => ({ data: { session: mocks.initialSession } }),
  },
  from: (table: string) => ({ select: () => ({ eq: (_column: string, id: string) => table === 'profiles'
    ? { maybeSingle: () => mocks.profile.get(id) }
    : mocks.roles.get(id) }) }),
} }));
vi.mock('@/integrations/supabase/legacy', () => ({ legacyClient: null, legacyEnabled: false }));
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

function Probe() {
  const { authUser, loading, userDataLoading } = useAuth();
  return <div>{loading ? 'loading' : authUser ? `${authUser.id}:${authUser.isAdmin}:${authUser.profile?.full_name ?? 'pending'}:${userDataLoading}` : 'signed-out'}</div>;
}
function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const session = (id: string) => ({ user: { id, email: `${id}@example.com` } });

function AdminHydrationProbe() {
  return <AuthProvider><MemoryRouter initialEntries={['/admin']}><Probe /><Routes>
    <Route path="/admin" element={<ProtectedRoute requireAdmin><p>Admin controls</p></ProtectedRoute>} />
    <Route path="/home" element={<p>Home redirect</p>} />
    <Route path="/login" element={<p>Login redirect</p>} />
  </Routes></MemoryRouter></AuthProvider>;
}

describe('account identity during delayed profile requests', () => {
  beforeEach(() => { mocks.profile.clear(); mocks.roles.clear(); mocks.initialSession = null; mocks.callback = null; });
  afterEach(cleanup);
  it('does not restore a signed-out account when its delayed admin profile arrives', async () => {
    const pending = deferred();
    mocks.profile.set('old', pending.promise);
    mocks.roles.set('old', Promise.resolve({ data: [{ role: 'admin' }] }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('signed-out');
    act(() => { mocks.callback!('SIGNED_IN', session('old')); });
    await screen.findByText('old:false:pending:true');
    act(() => { mocks.callback!('SIGNED_OUT', null); });
    await screen.findByText('signed-out');
    await act(async () => { pending.resolve({ data: { full_name: 'Old admin' } }); });
    expect(screen.getByText('signed-out')).toBeInTheDocument();
  });
  it('keeps the new learner identity when the previous admin request finishes later', async () => {
    const pending = deferred();
    mocks.profile.set('old', pending.promise);
    mocks.roles.set('old', Promise.resolve({ data: [{ role: 'admin' }] }));
    mocks.profile.set('new', Promise.resolve({ data: { full_name: 'New learner' } }));
    mocks.roles.set('new', Promise.resolve({ data: [{ role: 'student' }] }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('signed-out');
    act(() => { mocks.callback!('SIGNED_IN', session('old')); });
    act(() => { mocks.callback!('SIGNED_IN', session('new')); });
    await waitFor(() => expect(screen.getByText('new:false:New learner:false')).toBeInTheDocument());
    await act(async () => { pending.resolve({ data: { full_name: 'Old admin' } }); });
    expect(screen.getByText('new:false:New learner:false')).toBeInTheDocument();
  });

  it('keeps admin routing pending when an earlier same-account hydration finishes before INITIAL_SESSION', async () => {
    const first = deferred();
    const latest = deferred();
    mocks.initialSession = session('admin');
    mocks.profile.set('admin', first.promise);
    mocks.roles.set('admin', Promise.resolve({ data: [{ role: 'admin' }] }));
    render(<AdminHydrationProbe />);
    await screen.findByText('admin:false:pending:true');

    // getSession has begun its fetch; the SDK subsequently emits the same
    // account's initial-session event and starts a second profile/roles fetch.
    mocks.profile.set('admin', latest.promise);
    act(() => { mocks.callback!('INITIAL_SESSION', session('admin')); });
    await act(async () => { first.resolve({ data: { full_name: 'Earlier snapshot' } }); });
    expect(screen.getByText('admin:false:pending:true')).toBeInTheDocument();
    expect(screen.queryByText('Home redirect')).not.toBeInTheDocument();
    expect(screen.queryByText('Login redirect')).not.toBeInTheDocument();

    await act(async () => { latest.resolve({ data: { full_name: 'Latest admin' } }); });
    await screen.findByText('Admin controls');
    expect(screen.getByText('admin:true:Latest admin:false')).toBeInTheDocument();
  });

  it('does not restore stale admin roles after a newer same-account role fetch completes', async () => {
    const first = deferred();
    mocks.profile.set('same', first.promise);
    mocks.roles.set('same', Promise.resolve({ data: [{ role: 'admin' }] }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('signed-out');
    act(() => { mocks.callback!('SIGNED_IN', session('same')); });

    mocks.profile.set('same', Promise.resolve({ data: { full_name: 'Current learner' } }));
    mocks.roles.set('same', Promise.resolve({ data: [{ role: 'student' }] }));
    act(() => { mocks.callback!('TOKEN_REFRESHED', session('same')); });
    await screen.findByText('same:false:Current learner:false');
    await act(async () => { first.resolve({ data: { full_name: 'Stale admin' } }); });
    expect(screen.getByText('same:false:Current learner:false')).toBeInTheDocument();
  });

  it('ignores an earlier same-account fetch failure while the latest admin hydration is pending', async () => {
    const first = deferred();
    const latest = deferred();
    mocks.initialSession = session('admin');
    mocks.profile.set('admin', first.promise);
    mocks.roles.set('admin', Promise.resolve({ data: [{ role: 'admin' }] }));
    render(<AdminHydrationProbe />);
    await screen.findByText('admin:false:pending:true');
    mocks.profile.set('admin', latest.promise);
    act(() => { mocks.callback!('INITIAL_SESSION', session('admin')); });
    await act(async () => { first.reject(new Error('Earlier request was interrupted')); });
    expect(screen.getByText('admin:false:pending:true')).toBeInTheDocument();
    expect(screen.queryByText('Home redirect')).not.toBeInTheDocument();
    await act(async () => { latest.resolve({ data: { full_name: 'Current admin' } }); });
    await screen.findByText('Admin controls');
  });

  it('offers retry instead of redirecting when initial account permissions cannot be loaded', async () => {
    mocks.initialSession = session('admin');
    mocks.profile.set('admin', Promise.resolve({ data: { full_name: 'Admin' }, error: null }));
    mocks.roles.set('admin', Promise.resolve({ data: null, error: { message: 'Proxy request interrupted' } }));
    render(<AdminHydrationProbe />);
    await screen.findByText('Account verification interrupted');
    expect(screen.queryByText('Admin controls')).not.toBeInTheDocument();
    expect(screen.queryByText('Home redirect')).not.toBeInTheDocument();
    expect(screen.getByText('admin:false:pending:false')).toBeInTheDocument();

    mocks.roles.set('admin', Promise.resolve({ data: [{ role: 'admin' }], error: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry account verification' }));
    await screen.findByText('Admin controls');
    expect(screen.getByText('admin:true:Admin:false')).toBeInTheDocument();
  });

  it('preserves known identity on a transient role error and blocks admin controls until retry confirms permissions', async () => {
    mocks.initialSession = session('admin');
    mocks.profile.set('admin', Promise.resolve({ data: { full_name: 'Known admin' } }));
    mocks.roles.set('admin', Promise.resolve({ data: [{ role: 'admin' }] }));
    render(<AdminHydrationProbe />);
    await screen.findByText('Admin controls');

    mocks.roles.set('admin', Promise.resolve({ data: null, error: { message: 'Connection lost' } }));
    act(() => { mocks.callback!('TOKEN_REFRESHED', session('admin')); });
    await screen.findByText('Account verification interrupted');
    expect(screen.getByText('admin:true:Known admin:false')).toBeInTheDocument();
    expect(screen.queryByText('Admin controls')).not.toBeInTheDocument();
    expect(screen.queryByText('Home redirect')).not.toBeInTheDocument();

    // A successfully confirmed role removal must still take effect.
    mocks.roles.set('admin', Promise.resolve({ data: [{ role: 'student' }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry account verification' }));
    await screen.findByText('Home redirect');
    expect(screen.getByText('admin:false:Known admin:false')).toBeInTheDocument();
  });

  it('does not mistake a profile query error for a successful permission check', async () => {
    mocks.initialSession = session('admin');
    mocks.profile.set('admin', Promise.resolve({ data: null, error: { message: 'Profile unavailable' } }));
    mocks.roles.set('admin', Promise.resolve({ data: [{ role: 'admin' }] }));
    render(<AdminHydrationProbe />);
    await screen.findByText('Account verification interrupted');
    expect(screen.getByText('Could not load your account profile. Check your connection and retry.')).toBeInTheDocument();
    expect(screen.queryByText('Admin controls')).not.toBeInTheDocument();
    expect(screen.queryByText('Home redirect')).not.toBeInTheDocument();
  });
});
