import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import knowgraphLogo from '@/assets/knowgraph-logo.png';
import { clearAuthReturn, readAuthReturn, safeReturnPath } from '@/lib/auth-navigation';

type Status = 'verifying' | 'success' | 'error';

/**
 * Landing page for the link in the verification / recovery email.
 *
 * Supabase can hand the session back in three different shapes depending on the
 * flow, so all three are handled here rather than dumping the user on /login with
 * an unparsed token in the URL:
 *   - PKCE            -> ?code=...          (exchange it for a session)
 *   - implicit        -> #access_token=...  (the SDK parses this itself)
 *   - expired/invalid -> ?error=...         (tell the user, offer a new link)
 */
export default function AuthCallback() {
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [destination] = useState(() => safeReturnPath(searchParams.get('next') || readAuthReturn()));

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;

    const finish = (next: Status, msg: string) => {
      if (cancelled) return;
      setStatus(next);
      setMessage(msg);
      if (next !== 'verifying') {
        if (timeout) clearTimeout(timeout);
        unsubscribe?.();
        // OAuth credentials and one-time email codes should not remain in the
        // address bar or be copied along with a link to the callback page.
        window.history.replaceState(window.history.state, '', window.location.pathname);
      }
    };

    (async () => {
      // Supabase reports a bad or expired link in the hash, not the query string.
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const errorDescription =
        searchParams.get('error_description') ?? hashParams.get('error_description');
      const errorCode = searchParams.get('error') ?? hashParams.get('error');

      if (errorDescription || errorCode) {
        finish('error', errorDescription || 'Google sign-in was cancelled or could not be completed. Please try again.');
        return;
      }

      // getSession waits for the SDK's URL detection, which can already have
      // exchanged a PKCE code. Avoid consuming the same one-time code twice.
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError) {
        finish('error', sessionError.message);
        return;
      }
      if (data.session) {
        finish('success', '');
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        finish(error ? 'error' : 'success', error?.message || '');
        return;
      }

      // Older implicit links may deliver an auth event after mount.
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) finish('success', '');
      });
      unsubscribe = () => sub.subscription.unsubscribe();

      // Nothing arrived: the link was already used, or opened without a token.
      timeout = setTimeout(() => {
        finish(
          'error',
          'This sign-in link is no longer valid. It may have already been used or expired. Please sign in again.'
        );
      }, 5000);
    })().catch(error => finish('error', error instanceof Error ? error.message : 'Could not complete sign-in. Please try again.'));

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      unsubscribe?.();
    };
  }, [searchParams]);

  useEffect(() => {
    if (status !== 'success') return;
    clearAuthReturn();
    const t = setTimeout(() => navigate(destination, { replace: true }), 1000);
    return () => clearTimeout(t);
  }, [status, navigate, destination]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-xl border-border/50">
          <CardHeader className="text-center">
            <img src={knowgraphLogo} alt="KnowGraph" className="h-12 mx-auto mb-4" />

            {status === 'verifying' && (
              <>
                <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin text-primary" />
                <CardTitle className="text-2xl">Completing your sign-in…</CardTitle>
                <CardDescription>This will only take a moment.</CardDescription>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl">You're signed in</CardTitle>
                <CardDescription>
                  {destination === '/sponsored-access' ? 'Next, activate your sponsored course access…' : 'You’re all set. Taking you to your courses…'}
                </CardDescription>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl">Could not complete sign-in</CardTitle>
                <CardDescription>{message}</CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-2">
            {status === 'success' && (
              <Button className="w-full" size="lg" onClick={() => navigate(destination, { replace: true })}>
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}

            {status === 'error' && (
              <>
                <Button asChild className="w-full" size="lg">
                  <Link to="/login">Back to sign in</Link>
                </Button>
                <p className="text-center text-xs text-muted-foreground pt-2">
                  Try Google again, or request a fresh email verification link from the sign-in page.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
