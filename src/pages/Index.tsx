import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, ShieldCheck, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import heroGif from '@/assets/Create_a_smooth_202601060305.gif';
import updatedLogo from '@/assets/KnowGraph Logo.png';

export default function Index() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    (async () => {
      await supabase.auth.exchangeCodeForSession(window.location.href);
      window.history.replaceState({}, document.title, '/');
    })();
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={heroGif}
          alt="KnowGraph hero background"
          className="absolute inset-0 h-full w-full object-cover brightness-75"
        />
        <div className="absolute inset-0 bg-slate-950/45" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.24),_transparent_18%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.2),_transparent_22%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-slate-950/90 to-transparent" />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-10 top-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute right-16 top-10 h-44 w-44 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-16 lg:py-24 relative z-10">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] items-center">
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200 shadow-xl shadow-cyan-500/10"
            >
              <Sparkles className="w-4 h-4" />
              New product launch: join the waitlist.
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center gap-4">
                <img src={updatedLogo} alt="KnowGraph" className="h-16 w-auto rounded-2xl border border-white/10 bg-white/5 p-2 shadow-lg shadow-cyan-500/10" />
                <span className="rounded-full bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-cyan-200 shadow-sm shadow-cyan-500/10">
                  Soft launch soon
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight max-w-3xl">
                Build learning journeys that feel intuitive and connected.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                KnowGraph turns every course into a visual knowledge graph with capsules, checkpoints, and verified payment approval for learners and creators.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              <Button
                size="lg"
                asChild
                className="w-full sm:w-auto text-lg bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/25"
              >
                <Link to="/courses" className="inline-flex w-full items-center justify-center gap-2">
                  Explore courses
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="w-full sm:w-auto text-lg bg-slate-100 text-slate-950 hover:bg-slate-200"
              >
                <Link to="/signup" className="inline-flex w-full items-center justify-center">
                  Join waitlist
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl"
            >
              {[
                { icon: <TrendingUp className="w-5 h-5 text-cyan-300" />, value: 'Rapid adoption', label: 'Launch-ready' },
                { icon: <Zap className="w-5 h-5 text-violet-300" />, value: 'Graph-first flow', label: 'Learning paths' },
                { icon: <ShieldCheck className="w-5 h-5 text-sky-300" />, value: 'Secure payments', label: 'Receipt verified' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/5 px-5 py-6 text-center backdrop-blur-sm shadow-2xl shadow-slate-950/10">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/80 text-cyan-200 shadow-inner">
                    {stat.icon}
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-cyan-300">{stat.value}</div>
                  <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 shadow-2xl shadow-slate-950/40"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-950/40 to-transparent" />
            <div className="relative h-full w-full">
              <img src={heroGif} alt="KnowGraph hero animation" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/40 to-slate-950/90" />
            </div>

            <div className="pointer-events-none absolute left-6 top-6 rounded-full bg-cyan-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200 shadow-lg shadow-cyan-500/20">
              Launching soon
            </div>
            <div className="absolute inset-x-6 bottom-6 grid gap-3 rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-sm shadow-2xl shadow-slate-950/20 backdrop-blur-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-slate-300">
                <div>
                  <span className="text-xs uppercase tracking-[0.25em] text-slate-400">Ready for beta</span>
                </div>
                <span className="inline-flex rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold uppercase text-cyan-200">
                  Join waitlist
                </span>
              </div>
              <p className="text-sm font-medium text-white">Boost learner engagement with visual course graphs and capsule progress.</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
