import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MARKETING_CLIPS } from '@/lib/marketingMedia';
import heroVideo from '@/assets/hero.mp4';

/**
 * The hero background: real course output, cycling, full-bleed behind the copy.
 *
 * It used to be an abstract graph animation — decoration that said nothing about whether the
 * courses were any good — and the actual proof sat two screens below the fold. Now the first
 * thing anyone sees is a planner choosing a trajectory, or an AEB model calling BRAKE.
 *
 * Dimmed hard and covered by a scrim, because it is a BACKGROUND: the headline has to win.
 * A small label says what is playing, so it reads as evidence rather than as wallpaper —
 * without it, a viewer has no idea they are looking at something a learner built.
 *
 * Falls back to the abstract animation if no clips are present.
 */
const ROTATE_MS = 6000;

export default function HeroBackdrop() {
  const clips = MARKETING_CLIPS;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (clips.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % clips.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [clips.length]);

  const clip = clips[index];

  return (
    <>
      <div className="absolute inset-0 overflow-hidden">
        {clip ? (
          <AnimatePresence mode="sync">
            <motion.video
              key={clip.key}
              src={clip.url}
              autoPlay
              loop
              muted
              playsInline
              aria-hidden="true"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
              className="absolute inset-0 h-full w-full object-cover brightness-[0.4] saturate-[0.85]"
            />
          </AnimatePresence>
        ) : (
          <video
            src={heroVideo}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover brightness-[0.35] saturate-50"
          />
        )}

        {/* The copy has to win. Near-opaque on the left, clearing to the right. */}
        <div className="absolute inset-0 bg-slate-950/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70" />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.14),_transparent_26%)]" />

      {/*
        Says what is playing. Without it this is wallpaper; with it, it is evidence — the
        viewer knows they are watching something a learner built, not a stock loop.
      */}
      {clip && (
        <div className="pointer-events-auto absolute bottom-6 right-6 z-20 hidden max-w-xs rounded-2xl border border-white/15 bg-slate-950/80 p-4 backdrop-blur-md lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            You build this
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={clip.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              className="mt-1.5 text-sm font-medium leading-6 text-white"
            >
              {clip.title}
            </motion.p>
          </AnimatePresence>

          <div className="mt-3 flex items-center gap-1.5">
            {clips.map((c, i) => (
              <button
                key={c.key}
                onClick={() => setIndex(i)}
                aria-label={c.title}
                className={`h-1 rounded-full transition-all ${
                  i === index ? 'w-6 bg-cyan-300' : 'w-2.5 bg-white/25 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
