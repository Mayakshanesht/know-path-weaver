import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Rocket, ShieldCheck, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import heroVideo from '@/assets/hero.mp4';
import updatedLogo from '@/assets/KnowGraph Logo.png';
import ArticlesSection from '@/components/landing/ArticlesSection';
import BuiltByYou from '@/components/landing/BuiltByYou';

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
    <>
    <section className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      {/*
        The hero animation is a light, busy graph — text sat straight on top of it and was
        close to unreadable. It needs to be a background, not a competitor: dimmed hard, then
        covered by a scrim that is near-opaque on the left where the copy lives and clears
        towards the right so the animation is still visible.
      */}
      <div className="absolute inset-0 overflow-hidden">
        {/*
          Was a 4.4MB GIF, above the fold, blocking first paint. The same eight seconds as
          H.264 is 0.21MB — twenty times smaller — and it is dimmed to 35% behind a scrim
          anyway, so it can take the compression. GIF is a terrible format for a video.
        */}
        <video
          src={heroVideo}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover brightness-[0.35] saturate-50"
        />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_20%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.16),_transparent_24%)]" />
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
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-slate-950/80 px-4 py-2 text-sm font-medium text-cyan-200 shadow-xl shadow-cyan-500/20 backdrop-blur-md"
            >
              <Rocket className="w-4 h-4" />
              KnowGraph v1 is live — all five courses are open for enrolment.
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="space-y-6"
            >
              {/*
                This said "Soft launch soon" and the buttons said "Join waitlist". The site is
                live and selling, so anyone arriving from the launch post was being told they
                could not buy anything. The page now says what KnowGraph is and sends them to
                the courses.
              */}
              <div className="flex flex-wrap items-center gap-4">
                <img src={updatedLogo} alt="KnowGraph" className="h-16 w-auto rounded-2xl border border-white/10 bg-white/5 p-2 shadow-lg shadow-cyan-500/10" />
                <span className="rounded-full border border-cyan-400/40 bg-cyan-400/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100 shadow-sm shadow-cyan-500/20 backdrop-blur-md">
                  Now enrolling
                </span>
              </div>

              <h1
                className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight max-w-3xl text-white"
                style={{ textShadow: '0 2px 24px rgba(2,6,23,0.9)' }}
              >
                Robotics, taught as{' '}
                <span className="text-cyan-300">one pipeline</span>.
              </h1>
              <p
                className="max-w-2xl text-lg sm:text-xl font-medium leading-8 text-slate-100"
                style={{ textShadow: '0 1px 12px rgba(2,6,23,0.85)' }}
              >
                Most courses teach you one box on the diagram. You learn perception, and nobody
                tells you what the planner needed from it. KnowGraph teaches the whole stack in
                order — perception, prediction, planning, control and the safety case — where
                every module says what it builds on and what breaks without it.
              </p>
              <p
                className="max-w-2xl text-base leading-7 text-slate-300"
                style={{ textShadow: '0 1px 10px rgba(2,6,23,0.85)' }}
              >
                Real Colab notebooks and real datasets — KITTI, MetaDrive, GTSRB. You write the
                code. Browse every module and lesson before you pay anything.
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
                  Browse the courses
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                asChild
                className="w-full sm:w-auto text-lg bg-slate-100 text-slate-950 hover:bg-slate-200"
              >
                <Link to="/signup" className="inline-flex w-full items-center justify-center">
                  Create your account
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl"
            >
              {/*
                Real, checkable numbers instead of "Rapid adoption" and "Graph-first flow",
                which promised nothing a learner could verify or care about.
              */}
              {[
                { icon: <BookOpen className="w-5 h-5 text-cyan-300" />, value: '178 lessons', label: 'Across 5 courses and 45 modules' },
                { icon: <Zap className="w-5 h-5 text-violet-300" />, value: '118 hours', label: 'Lectures, notebooks and projects' },
                { icon: <ShieldCheck className="w-5 h-5 text-sky-300" />, value: '96 quizzes', label: 'Testing understanding, not recall' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-3xl border border-white/15 bg-slate-950/85 px-5 py-6 text-center shadow-2xl shadow-slate-950/40 backdrop-blur-md"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-cyan-300 shadow-inner">
                    {stat.icon}
                  </div>
                  <div className="mt-4 text-2xl font-bold text-cyan-300">{stat.value}</div>
                  <div className="mt-2 text-sm text-slate-300">{stat.label}</div>
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
              <video
                src={heroVideo}
                autoPlay
                loop
                muted
                playsInline
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/40 to-slate-950/90" />
            </div>

            <div className="pointer-events-none absolute left-6 top-6 rounded-full bg-cyan-400/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-200 shadow-lg shadow-cyan-500/20">
              Live now
            </div>
            <div className="absolute inset-x-6 bottom-6 grid gap-3 rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-sm shadow-2xl shadow-slate-950/20 backdrop-blur-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-slate-300">
                <div>
                  <span className="text-xs uppercase tracking-[0.25em] text-slate-400">The pipeline</span>
                </div>
                <span className="inline-flex rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold uppercase text-cyan-200">
                  Certificate included
                </span>
              </div>
              <p className="text-sm font-medium text-white">
                Sense → Perceive → Predict → Plan → Control → Certify. Taught in that order,
                because that is the order it has to work in.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>

    <BuiltByYou />
    <ArticlesSection />
    </>
  );
}
