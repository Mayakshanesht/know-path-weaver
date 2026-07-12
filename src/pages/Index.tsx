import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import landingGraph from '@/assets/landing-graph.svg';

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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.18),_transparent_25%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-slate-950/90 to-transparent" />
      <div className="container mx-auto px-4 py-16 lg:py-24 relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200"
            >
              <Sparkles className="w-4 h-4" />
              Graph-first learning, reimagined.
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-6"
            >
              <h1 className="text-5xl sm:text-6xl font-bold leading-tight tracking-tight">
                Learn with a smarter curriculum map.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                KnowGraph helps students and creators build connected courses, track progress, and unlock every capsule with a visual path that feels intuitive.
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
                className="w-full sm:w-auto text-lg bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20"
              >
                <Link to="/courses" className="inline-flex w-full items-center justify-center gap-2">
                  Browse courses
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="w-full sm:w-auto text-lg bg-slate-100 text-slate-950 hover:bg-slate-200"
              >
                <Link to="/signup" className="inline-flex w-full items-center justify-center">
                  Create account
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl"
            >
              {[
                { value: '10+', label: 'Courses' },
                { value: '120+', label: 'Capsules' },
                { value: '500+', label: 'Learners' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-5 text-center backdrop-blur-sm">
                  <div className="text-2xl font-semibold text-cyan-300">{stat.value}</div>
                  <div className="mt-2 text-sm text-slate-400">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/90 shadow-2xl shadow-slate-950/40"
          >
            <img src={landingGraph} alt="Curriculum graph illustration" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/10 to-slate-950/80" />
            <div className="pointer-events-none absolute left-6 top-6 rounded-full bg-cyan-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200">
              Live preview
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
