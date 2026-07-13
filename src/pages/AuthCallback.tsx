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

  useEffect(() => {
    let cancelled = false;

    const finish = (next: Status, msg: string) => {
      if (cancelled) return;
      setStatus(next);
      setMessage(msg);
    };

    (async () => {
      // Supabase reports a bad or expired link in the hash, not the query string.
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const errorDescription =
        searchParams.get('error_description') ?? hashParams.get('error_description');

      if (errorDescription) {
        finish('error', errorDescription);
        return;
      }

      const code = searchParams.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          finish('error', error.message);
          return;
        }
        finish('success', '');
        return;
      }

      // Implicit flow: detectSessionInUrl already consumed the hash, so the session
      // may land a tick after mount. Listen rather than race it.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        finish('success', '');
        return;
      }

      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) finish('success', '');
      });

      // Nothing arrived: the link was already used, or opened without a token.
      const timeout = setTimeout(() => {
        finish(
          'error',
          'This verification link is no longer valid. It may have already been used or expired.'
        );
      }, 5000);

      return () => {
        clearTimeout(timeout);
        sub.subscription.unsubscribe();
      };
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(() => navigate('/home', { replace: true }), 1500);
    return () => clearTimeout(t);
  }, [status, navigate]);

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
                <CardTitle className="text-2xl">Verifying your email…</CardTitle>
                <CardDescription>This will only take a moment.</CardDescription>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-2xl">Email verified</CardTitle>
                <CardDescription>
                  You're all set. Taking you to your courses…
                </CardDescription>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl">Verification failed</CardTitle>
                <CardDescription>{message}</CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-2">
            {status === 'success' && (
              <Button className="w-full" size="lg" onClick={() => navigate('/home')}>
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
                  You can request a fresh verification email from the sign-in page.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
