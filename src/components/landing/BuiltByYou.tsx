import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MARKETING_CLIPS, type MarketingClip } from '@/lib/marketingMedia';

/**
 * What a learner actually builds, shown running.
 *
 * This is the strongest marketing the platform has and it was not being used at all — the
 * landing page led with a stock animation of an abstract graph, which says nothing about
 * whether the course is any good. A planner choosing a trajectory, or an AEB model calling
 * BRAKE on a closing gap, says everything.
 *
 * Renders nothing at all when no clips are present, so the page never shows an empty section.
 */
function Clip({ clip }: { clip: MarketingClip }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-slate-950/40"
    >
      <div className="bg-slate-950">
        {clip.isVideo ? (
          <video
            src={clip.url}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            className="h-auto w-full"
            aria-label={clip.title}
          />
        ) : (
          <img src={clip.url} alt={clip.title} loading="lazy" className="h-auto w-full" />
        )}
      </div>
      <figcaption className="p-5">
        <h3 className="text-lg font-semibold text-white">{clip.title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-slate-400">{clip.caption}</p>
      </figcaption>
    </motion.figure>
  );
}

export default function BuiltByYou() {
  if (MARKETING_CLIPS.length === 0) return null;

  return (
    <section className="bg-slate-950 py-20 text-slate-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            You build these
          </p>
          <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
            Not slides about autonomy. Autonomy that runs.
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            Every one of these is output from a project in the courses — your code, your notebook,
            your model. You will have built them, not watched someone else build them.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {MARKETING_CLIPS.map((clip) => (
            <Clip key={clip.key} clip={clip} />
          ))}
        </div>

        <div className="mt-12">
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-6 py-3 font-semibold text-slate-950 shadow-lg shadow-cyan-500/25"
          >
            See the courses that build them
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
