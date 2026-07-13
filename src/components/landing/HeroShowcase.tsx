import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MARKETING_CLIPS } from '@/lib/marketingMedia';

/**
 * Real course output, in the hero, above the fold.
 *
 * The right half of the hero used to show the same abstract graph animation as the
 * background — so the first thing a visitor saw was decoration twice, and the actual proof
 * that the courses are any good sat two screens further down where nobody scrolled to it.
 *
 * This is the strongest argument the platform has: a planner choosing a trajectory, an AEB
 * model calling BRAKE on a closing gap. It belongs in the first viewport.
 *
 * Cycles rather than showing a grid, because a grid of six videos in the hero is both slow
 * and unreadable. Auto-advances, and the dots let anyone jump straight to the one they care
 * about — a controls engineer wants the ACC clip, not the segmentation one.
 */
const ROTATE_MS = 5500;

export default function HeroShowcase() {
  const clips = MARKETING_CLIPS;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || clips.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % clips.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused, clips.length]);

  if (clips.length === 0) return null;

  const clip = clips[index];

  return (
    <div
      className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-slate-900/80 shadow-2xl shadow-slate-950/50 backdrop-blur-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute left-5 top-5 z-20 rounded-full border border-cyan-400/40 bg-slate-950/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200 backdrop-blur-md">
        You build this
      </div>

      <div className="relative aspect-[16/10] bg-slate-950">
        <AnimatePresence mode="wait">
          <motion.div
            key={clip.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0"
          >
            {clip.isVideo ? (
              <video
                src={clip.url}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-contain"
                aria-label={clip.title}
              />
            ) : (
              <img src={clip.url} alt={clip.title} className="h-full w-full object-contain" />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
      </div>

      <div className="relative -mt-14 px-6 pb-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={clip.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            <h3 className="text-lg font-semibold text-white">{clip.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-400">{clip.caption}</p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-4 flex items-center gap-2">
          {clips.map((c, i) => (
            <button
              key={c.key}
              onClick={() => setIndex(i)}
              aria-label={c.title}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-8 bg-cyan-300' : 'w-3 bg-white/25 hover:bg-white/50'
              }`}
            />
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {index + 1} / {clips.length}
          </span>
        </div>
      </div>
    </div>
  );
}
