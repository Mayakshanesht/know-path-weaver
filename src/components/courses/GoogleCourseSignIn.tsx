import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function GoogleCourseSignIn({ returnTo }: { returnTo: string }) {
  const { user, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (user) return null;

  const signIn = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await signInWithGoogle(returnTo);
      if (result.error) throw result.error;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Google sign-in could not start. Please try again.');
    } finally { setBusy(false); }
  };

  return <div className="space-y-2">
    <Button type="button" className="w-full bg-white text-slate-950 hover:bg-slate-100" disabled={busy} onClick={() => void signIn()}>
      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-3 text-lg font-bold" aria-hidden="true">G</span>}
      Continue with Google
    </Button>
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
  </div>;
}
