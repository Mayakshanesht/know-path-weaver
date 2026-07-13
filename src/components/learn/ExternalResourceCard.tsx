import { ArrowUpRight, Github, Link2, Notebook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ResourceKind = 'colab' | 'github' | 'weblink';

const KIND = {
  colab: {
    icon: Notebook,
    name: 'Google Colab',
    action: 'Open notebook',
    blurb: 'Run this notebook in your browser — no setup required.',
    accent: 'from-amber-500/20 to-orange-500/5',
    ring: 'group-hover:border-amber-400/50',
    iconColor: 'text-amber-300',
  },
  github: {
    icon: Github,
    name: 'GitHub',
    action: 'View repository',
    blurb: 'Browse the source, clone it, or follow along with the code.',
    accent: 'from-violet-500/20 to-fuchsia-500/5',
    ring: 'group-hover:border-violet-400/50',
    iconColor: 'text-violet-300',
  },
  weblink: {
    icon: Link2,
    name: 'External resource',
    action: 'Open resource',
    blurb: 'This resource opens in a new tab.',
    accent: 'from-sky-500/20 to-cyan-500/5',
    ring: 'group-hover:border-sky-400/50',
    iconColor: 'text-sky-300',
  },
} as const satisfies Record<ResourceKind, unknown>;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Presentation for content that genuinely cannot be embedded.
 *
 * Colab and GitHub both send X-Frame-Options/frame-ancestors headers that forbid
 * being iframed, so there is no embed to fall back from. Rather than apologise for
 * a broken frame, this treats opening in a new tab as the intended, first-class
 * action.
 */
export default function ExternalResourceCard({
  url,
  kind,
  title,
  description,
  className,
}: {
  url: string;
  kind: ResourceKind;
  title?: string | null;
  description?: string | null;
  className?: string;
}) {
  const meta = KIND[kind];
  const Icon = meta.icon;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group relative block w-full overflow-hidden rounded-2xl border border-white/10',
        'bg-slate-900 p-6 transition-all duration-300',
        'hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-slate-950/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        meta.ring,
        className
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70',
          meta.accent
        )}
      />

      <div className="relative flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <Icon className={cn('h-6 w-6', meta.iconColor)} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {meta.name}
            </span>
            <span className="text-slate-600">•</span>
            <span className="truncate text-xs text-slate-400">{hostOf(url)}</span>
          </div>

          <h3 className="mt-1 truncate text-lg font-semibold text-white">
            {title || meta.name}
          </h3>

          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            {description || meta.blurb}
          </p>
        </div>

        <Button
          type="button"
          tabIndex={-1}
          className="hidden flex-shrink-0 bg-white text-slate-900 hover:bg-slate-100 sm:inline-flex"
        >
          {meta.action}
          <ArrowUpRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>

      <div className="relative mt-4 flex items-center gap-1.5 text-sm font-medium text-white sm:hidden">
        {meta.action}
        <ArrowUpRight className="h-4 w-4" />
      </div>
    </a>
  );
}
