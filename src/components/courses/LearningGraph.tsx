import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The course as a graph: how the modules connect, and where you are in them.
 *
 * A syllabus is a list, and a list does not tell you why module 7 follows module 6.
 * This does — it shows the chain from foundations through to the capstone, so a learner
 * can see the shape of the thing they are buying (or the thing they are halfway
 * through) rather than reading fourteen titles and hoping.
 *
 * Two modes:
 *   - Public (no progress passed): the path, as a promise.
 *   - Enrolled (progress passed): the same path, with where you actually are.
 */

export interface GraphNode {
  id: string;
  title: string;
  /** Lessons in this module. */
  total: number;
  /** Lessons completed. Omit for the public view. */
  completed?: number;
}

/** Groups a module into a stage of the pipeline, from its title. */
function stageOf(title: string): { label: string; tone: string } {
  const t = title.toLowerCase();
  if (/foundation|programming|python|c\+\+|data structure|lab|workflow|primer/.test(t))
    return { label: 'Foundations', tone: 'text-slate-400 border-slate-500/30 bg-slate-500/10' };
  if (/perception|vision|deep learning|machine learning|reinforcement|supervised|ml/.test(t))
    return { label: 'Perception & Learning', tone: 'text-sky-300 border-sky-400/30 bg-sky-400/10' };
  if (/planning|prediction|decision/.test(t))
    return { label: 'Planning', tone: 'text-violet-300 border-violet-400/30 bg-violet-400/10' };
  if (/control|dynamics|mpc|lqr|estimation/.test(t))
    return { label: 'Control', tone: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' };
  if (/safety|systems engineering|iso/.test(t))
    return { label: 'Safety', tone: 'text-amber-300 border-amber-400/30 bg-amber-400/10' };
  if (/capstone|certificate|project/.test(t))
    return { label: 'Capstone', tone: 'text-rose-300 border-rose-400/30 bg-rose-400/10' };
  return { label: 'Core', tone: 'text-slate-400 border-slate-500/30 bg-slate-500/10' };
}

export default function LearningGraph({
  nodes,
  onSelect,
  className,
}: {
  nodes: GraphNode[];
  onSelect?: (id: string) => void;
  className?: string;
}) {
  if (nodes.length === 0) return null;

  const showsProgress = nodes.some((n) => typeof n.completed === 'number');

  return (
    <div className={cn('relative', className)}>
      <ol className="relative space-y-3">
        {nodes.map((node, i) => {
          const stage = stageOf(node.title);
          const done = node.completed ?? 0;
          const isComplete = showsProgress && node.total > 0 && done >= node.total;
          const isStarted = showsProgress && done > 0 && !isComplete;
          const pct = node.total > 0 ? Math.round((done / node.total) * 100) : 0;

          // The previous module being unfinished is what gates this one visually — it
          // is a suggestion, not a lock, because nothing in the data forbids skipping.
          const prev = nodes[i - 1];
          const isNext =
            showsProgress &&
            !isComplete &&
            !isStarted &&
            (!prev || (prev.completed ?? 0) >= prev.total);

          return (
            <li key={node.id} className="relative">
              {/* The edge to the next node. This is the "graph" part: it says these are
                  a sequence, not a menu. */}
              {i < nodes.length - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute left-[19px] top-[44px] h-[calc(100%-28px)] w-px',
                    isComplete ? 'bg-primary/50' : 'bg-border'
                  )}
                />
              )}

              <motion.button
                type="button"
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
                onClick={() => onSelect?.(node.id)}
                disabled={!onSelect}
                className={cn(
                  'group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                  onSelect && 'hover:border-primary/40 hover:bg-muted/50',
                  isNext && 'border-primary/40 bg-primary/5'
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
                    isComplete
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isStarted
                        ? 'border-primary/50 text-primary'
                        : 'border-border text-muted-foreground'
                  )}
                >
                  {isComplete ? <Check className="h-5 w-5" /> : i + 1}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                        stage.tone
                      )}
                    >
                      {stage.label}
                    </span>
                    {isNext && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                        You are here
                      </span>
                    )}
                  </span>

                  <span className="mt-1 block font-medium leading-snug">{node.title}</span>

                  {showsProgress ? (
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {done}/{node.total}
                      </span>
                    </span>
                  ) : (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {node.total} {node.total === 1 ? 'lesson' : 'lessons'}
                    </span>
                  )}
                </span>
              </motion.button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
