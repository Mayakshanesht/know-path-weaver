import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import loginIllustration from '@/assets/login-illustration.svg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in."
      });
      navigate('/home', { replace: true });
    }

    setIsLoading(false);
  };

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

            <Card className="bg-slate-950/90 border-white/10 shadow-none">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl">Sign in</CardTitle>
                <CardDescription>Access your course graph and continue learning.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
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
                      type="password"
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
                    <Link to="/signup" className="text-sm text-cyan-300 hover:text-cyan-100 transition-colors">
                      Create account
                    </Link>
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
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
            <img src={loginIllustration} alt="Secure learning login illustration" className="w-full rounded-[1.75rem]" />
            <div className="pointer-events-none absolute inset-x-6 top-6 h-1 rounded-full bg-gradient-to-r from-cyan-300/50 via-slate-100/30 to-violet-400/40" />
            <div className="absolute bottom-6 left-6 rounded-full bg-slate-950/80 px-4 py-2 text-xs uppercase tracking-[0.24em] text-cyan-200/90">
              Secure access
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
