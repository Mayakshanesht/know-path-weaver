import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { readSponsorCode, rememberSponsorCode, safeReturnPath } from '@/lib/auth-navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sponsorCode, setSponsorCode] = useState(readSponsorCode);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  // Non-null once we've confirmed this is an existing learner on the old project
  // who needs to choose a password for the new one.
  const [v1Token, setV1Token] = useState<string | null>(null);
  const [alreadyMigrated, setAlreadyMigrated] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [migrating, setMigrating] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signInWithGoogle, resendVerification, checkLegacyAccount, migrateLegacyAccount } = useAuth();
  const requestedFrom = location.state?.from;
  const destination = safeReturnPath(typeof requestedFrom?.pathname === 'string'
    ? `${requestedFrom.pathname}${typeof requestedFrom.search === 'string' ? requestedFrom.search : ''}`
    : undefined);
  const couponDestination = destination.startsWith('/courses/') ? destination : '/courses';
  const afterSignIn = sponsorCode.trim() ? couponDestination : destination;
  const { toast } = useToast();

  const handleGoogle = async (sponsored = false) => {
    rememberSponsorCode(sponsorCode);
    const returnTo = sponsored || sponsorCode.trim() ? couponDestination : destination;
    if (user) {
      navigate(returnTo);
      return;
    }
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle(returnTo);
      if (error) throw error;
    } catch (error) {
      toast({
        title: 'Could not start Google sign-in',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    rememberSponsorCode(sponsorCode);
    setNeedsVerification(false);

    const { error } = await signIn(email, password);

    if (!error) {
      toast({ title: 'Welcome back!', description: "You've successfully logged in." });
      navigate(afterSignIn, { replace: true });
      setIsLoading(false);
      return;
    }

    // Sign-in failed here. Before calling it a bad password, check whether this is
    // an existing learner who has not been moved to the new system yet — their old
    // password still works against the old project.
    const legacy = await checkLegacyAccount(email, password);

    if (legacy.found) {
      setV1Token(legacy.v1AccessToken);
      // Distinguishes "you need to move" from "you've moved, this is your OLD
      // password". Without this, a migrated user whose browser autofills the old
      // password sees the migration pitch on every login.
      setAlreadyMigrated(legacy.alreadyMigrated);
      setIsLoading(false);
      return;
    }

    // Supabase rejects an unverified account with this specific code. Without
    // calling it out, the user just sees a generic failure and has no way back.
    const unverified =
      (error as { code?: string }).code === 'email_not_confirmed' ||
      /email not confirmed/i.test(error.message);

    setNeedsVerification(unverified);
    toast({
      title: unverified ? 'Verify your email first' : 'Login failed',
      description: unverified
        ? `We sent a verification link to ${email}. Confirm it, then sign in.`
        : error.message,
      variant: 'destructive',
    });

    setIsLoading(false);
  };

  const handleMigrate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v1Token) return;

    if (newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Use at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    setMigrating(true);
    const { error } = await migrateLegacyAccount(email, v1Token, newPassword);

    if (error) {
      toast({
        title: 'Could not move your account',
        description: error.message,
        variant: 'destructive',
      });
      setMigrating(false);
      return;
    }

    toast({
      title: alreadyMigrated ? 'Password updated' : 'All set',
      description: alreadyMigrated
        ? 'Signed in with your new password.'
        : 'Your account, courses and progress have moved across.',
    });
    navigate(afterSignIn, { replace: true });
    setMigrating(false);
  };

  const handleResend = async () => {
    setResending(true);
    const { error } = await resendVerification(email, afterSignIn);
    toast({
      title: error ? 'Could not resend' : 'Verification email sent',
      description: error ? error.message : `Check the inbox for ${email}.`,
      variant: error ? 'destructive' : 'default',
    });
    setResending(false);
  };

  // An existing learner whose account is still on the old system. They have just
  // proved they own it, so all that is left is choosing a password for the new one.
  if (v1Token) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4 text-slate-50">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.15),_transparent_30%)]" />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900/85 p-8 shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15">
            <ShieldCheck className="h-6 w-6 text-cyan-300" />
          </div>

          <h1 className="text-2xl font-semibold">
            {alreadyMigrated ? 'That’s your old password' : 'One quick step'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {alreadyMigrated ? (
              <>
                Your account has already moved. Sign in with the new password you
                chose — or, since you’ve just proved this account is yours, set a new
                one below.
              </>
            ) : (
              <>
                We’ve moved KnowGraph to a new, more secure platform. Your courses and
                progress are already waiting for you — we just need you to choose a new
                password, because we can’t carry the old one across.
              </>
            )}
          </p>

          <form onSubmit={handleMigrate} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="migrateEmail">Email</Label>
              <Input
                id="migrateEmail"
                name="username"
                type="email"
                value={email}
                readOnly
                autoComplete="username"
                className="bg-slate-800/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">
                {alreadyMigrated ? 'Set a new password' : 'Choose a new password'}
              </Label>
              <Input
                id="newPassword"
                name="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoFocus
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={migrating}>
              {migrating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {alreadyMigrated ? 'Updating...' : 'Moving your account...'}
                </>
              ) : alreadyMigrated ? (
                'Set password and sign in'
              ) : (
                'Continue'
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setV1Token(null);
                setAlreadyMigrated(false);
                setNewPassword('');
                setPassword('');
              }}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
            >
              {alreadyMigrated ? 'Back — I’ll use my new password' : 'Cancel'}
            </button>
          </form>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.15),_transparent_30%)]" />
      <div className="container mx-auto px-4 py-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] items-center">
          <motion.div
            className="rounded-[2rem] border border-white/10 bg-slate-900/85 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl"
            initial={{ opacity: 0, scale: 0.98, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Link
              to="/"
              className="inline-flex items-center text-slate-300 hover:text-slate-100 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>

            <Card className="bg-slate-950/90 border-white/10 text-slate-50 shadow-none">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl">Sign in</CardTitle>
                <CardDescription className="text-slate-300">Access your course graph and continue learning.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 space-y-3">
                  <Label htmlFor="sponsor-code">Sponsorship coupon <span className="font-normal text-slate-400">(optional)</span></Label>
                  <Input
                    id="sponsor-code"
                    value={sponsorCode}
                    onChange={(event) => setSponsorCode(event.target.value)}
                    maxLength={128}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="Enter the code shared with your team"
                    className="bg-slate-950/90 text-slate-50"
                    aria-describedby="sponsor-code-help"
                  />
                  <p id="sponsor-code-help" className="text-xs leading-relaxed text-slate-400">
                    This code is saved for course checkout. Sign in, choose a course, apply the coupon, and review the discount and remaining total.
                  </p>
                  <Button type="button" className="w-full bg-white text-slate-950 hover:bg-slate-100" onClick={() => handleGoogle()} disabled={googleLoading}>
                    {googleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-3 text-lg font-bold" aria-hidden="true">G</span>}
                    {user ? 'Continue with your signed-in account' : 'Continue with Google'}
                  </Button>
                  {user && <p className="break-all text-center text-xs text-slate-400">Signed in as {user.email}</p>}
                </div>
                <div className="mb-6 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-white/10" />Or sign in with email<span className="h-px flex-1 bg-white/10" /></div>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-slate-950/90 text-slate-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-slate-950/90 text-slate-50"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link to="/forgot-password" className="text-sm text-cyan-300 hover:text-cyan-100 transition-colors">
                      Forgot password?
                    </Link>
                    <Link to="/signup" state={{ from: { pathname: afterSignIn } }} className="text-sm text-cyan-300 hover:text-cyan-100 transition-colors">
                      Create account
                    </Link>
                  </div>

                  <Button type="submit" className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </Button>

                  {needsVerification && (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm">
                      <p className="text-slate-100">
                        This account hasn't been verified yet. Open the link we emailed
                        to <span className="font-medium">{email}</span>, or send a new one.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={handleResend}
                        disabled={resending}
                      >
                        {resending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          'Resend verification email'
                        )}
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            <div className="mt-6 rounded-3xl border border-cyan-300/10 bg-cyan-500/10 p-4 text-slate-100">
              <div className="flex items-center gap-3 text-sm">
                <span className="rounded-full bg-cyan-400/15 p-2 text-cyan-200">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <div>
                  Secure login for all learners. Your progress and curriculum stays synced.
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="mb-6 inline-flex rounded-full border border-cyan-300/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold tracking-wide text-cyan-200">
              KnowGraph × SAEINDIA 2027
            </div>
            <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">aBAJA teams, your learning starts here.</h2>
            <p className="mt-4 leading-relaxed text-slate-300">
              KnowGraph sponsors free access to all published courses for aBAJA team members and the aBAJA technical committee. No payment or card required.
            </p>
            <ol className="my-7 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-slate-200 marker:font-semibold marker:text-cyan-300">
              <li>Get your sponsorship code from your team captain or KnowGraph coordinator. Technical committee members receive a separate code.</li>
              <li>Create your own account and verify your email, or continue with Google. Use this same account on the website and KnowGraph app.</li>
              <li>Open a course page, apply your coupon, and check the 100% discount and ₹0 total. Confirm your full name and college or organization.</li>
              <li>Select Complete free enrollment, then open your classroom or mobile app. Keep your code within your assigned team.</li>
            </ol>
            <Button type="button" size="lg" className="w-full bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => handleGoogle(true)} disabled={googleLoading}>
              {googleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {user ? 'Choose a course to enroll' : 'Continue with Google for free access'}
            </Button>
            <p className="mt-5 text-xs leading-relaxed text-slate-400">
              A verified account and your invitation roster control eligibility. Applying a coupon previews the discount; completing enrollment claims your seat. This browser remembers your sign-in; sign out after using a shared computer.
            </p>
            <p className="mt-4 text-xs text-slate-400">
              Share this sign-in page: <a className="break-all text-cyan-300 hover:text-cyan-100" href="https://courses.knowgraphapp.com/login">courses.knowgraphapp.com/login</a>
            </p>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
