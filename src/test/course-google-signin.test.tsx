import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ signInWithGoogle: vi.fn(), user: null as null | { id: string } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => mocks }));
import GoogleCourseSignIn from '@/components/courses/GoogleCourseSignIn';

describe('Google sign-in from course pages', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); mocks.user = null; mocks.signInWithGoogle.mockResolvedValue({ error: null }); });
  it.each(['/courses', '/courses/selected-course'])('returns the learner to %s after Google sign-in', async returnTo => {
    render(<GoogleCourseSignIn returnTo={returnTo} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' })); });
    expect(mocks.signInWithGoogle).toHaveBeenCalledWith(returnTo);
  });
  it('shows a provider error and lets the learner retry', async () => {
    mocks.signInWithGoogle.mockResolvedValue({ error: new Error('Provider temporarily unavailable') });
    render(<GoogleCourseSignIn returnTo="/courses/selected-course" />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Provider temporarily unavailable');
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  });
  it('keeps the current account when already signed in', () => {
    mocks.user = { id: 'learner' };
    render(<GoogleCourseSignIn returnTo="/courses" />);
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument();
    expect(mocks.signInWithGoogle).not.toHaveBeenCalled();
  });
});
