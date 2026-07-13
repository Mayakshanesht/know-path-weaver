import { useMemo } from 'react';

/**
 * A generated cover per course.
 *
 * Replaces the stock Unsplash car photos, which said nothing about the course and
 * were the same generic image a hundred other sites use. These are drawn from the
 * course's own subject — a trajectory for control, sensor cones for ADAS, a lattice
 * for planning — so the five are distinguishable at a glance in a grid.
 *
 * SVG, not raster: sharp at any size, a few hundred bytes, no network request, and
 * nothing to 404.
 */

type Motif = 'adas' | 'control' | 'planning' | 'ai' | 'perception';

const THEME: Record<Motif, { from: string; to: string; ink: string; accent: string }> = {
  adas:       { from: '#0c4a6e', to: '#082f49', ink: '#7dd3fc', accent: '#38bdf8' },
  control:    { from: '#134e4a', to: '#042f2e', ink: '#5eead4', accent: '#2dd4bf' },
  planning:   { from: '#4c1d95', to: '#2e1065', ink: '#c4b5fd', accent: '#a78bfa' },
  ai:         { from: '#831843', to: '#4c0519', ink: '#f9a8d4', accent: '#f472b6' },
  perception: { from: '#78350f', to: '#431407', ink: '#fcd34d', accent: '#fbbf24' },
};

/** Chosen from the title, so a renamed or newly added course still gets a sensible cover. */
export function motifFor(title: string): Motif {
  const t = title.toLowerCase();
  if (t.includes('perception') || t.includes('vision')) return 'perception';
  if (t.includes('planning') || t.includes('prediction')) return 'planning';
  if (t.includes('dynamics') || t.includes('control')) return 'control';
  if (t.includes('ai ') || t.includes('bootcamp') || t.includes('llm')) return 'ai';
  return 'adas';
}

function Motif({ motif, c }: { motif: Motif; c: (typeof THEME)[Motif] }) {
  switch (motif) {
    // A vehicle and its sensor field of view.
    case 'adas':
      return (
        <g fill="none" stroke={c.ink} strokeWidth="1.5">
          <path d="M200 175 L120 95 A110 110 0 0 1 280 95 Z" fill={c.accent} opacity="0.10" stroke="none" />
          <path d="M200 175 L150 90 A70 70 0 0 1 250 90 Z" fill={c.accent} opacity="0.14" stroke="none" />
          <rect x="182" y="168" width="36" height="20" rx="4" fill={c.accent} opacity="0.9" stroke="none" />
          <circle cx="200" cy="178" r="52" opacity="0.25" />
          <circle cx="200" cy="178" r="82" opacity="0.15" />
          <circle cx="200" cy="178" r="112" opacity="0.08" />
        </g>
      );

    // A step response settling onto its setpoint: PID → LQR → MPC.
    case 'control':
      return (
        <g fill="none" strokeWidth="2">
          <line x1="40" y1="120" x2="360" y2="120" stroke={c.ink} strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
          <path d="M40 190 L110 190 L110 60 L140 175 L165 85 L190 145 L215 108 L240 128 L265 118 L300 122 L360 121"
                stroke={c.accent} strokeLinejoin="round" />
          <path d="M40 190 L110 190 L110 95 L150 118 L200 122 L280 121 L360 121"
                stroke={c.ink} opacity="0.55" strokeLinejoin="round" />
          {[110, 165, 215, 265].map((x, i) => (
            <circle key={i} cx={x} cy={121} r="3" fill={c.accent} stroke="none" opacity="0.8" />
          ))}
        </g>
      );

    // A lattice of candidate trajectories, one of them chosen.
    case 'planning':
      return (
        <g fill="none" strokeWidth="1.5">
          {[-60, -35, -12, 12, 35, 60].map((dy, i) => (
            <path key={i} d={`M50 130 C 150 130, 230 ${130 + dy}, 350 ${130 + dy * 1.5}`}
                  stroke={c.ink} opacity={0.28} />
          ))}
          <path d="M50 130 C 150 130, 230 118, 350 112" stroke={c.accent} strokeWidth="3" />
          <circle cx="50" cy="130" r="5" fill={c.accent} stroke="none" />
          <circle cx="350" cy="112" r="5" fill={c.accent} stroke="none" />
          {[110, 170, 230, 290].map((x, i) => (
            <line key={i} x1={x} y1="60" x2={x} y2="200" stroke={c.ink} opacity="0.10" />
          ))}
        </g>
      );

    // Layers of a network, densely connected.
    case 'ai': {
      const cols = [90, 165, 240, 315];
      const rows = [70, 110, 150, 190];
      return (
        <g>
          {cols.slice(0, -1).map((x, ci) =>
            rows.map((y1, i) =>
              rows.map((y2, j) => (
                <line key={`${ci}-${i}-${j}`} x1={x} y1={y1} x2={cols[ci + 1]} y2={y2}
                      stroke={c.ink} strokeWidth="0.6" opacity="0.16" />
              ))
            )
          )}
          {cols.map((x, ci) =>
            rows.map((y, i) => (
              <circle key={`${ci}-${i}`} cx={x} cy={y} r={ci === 0 || ci === 3 ? 5 : 6}
                      fill={ci === 3 ? c.accent : c.ink} opacity={ci === 3 ? 0.95 : 0.6} />
            ))
          )}
        </g>
      );
    }

    // A camera frustum projecting onto a depth grid.
    case 'perception':
      return (
        <g fill="none" strokeWidth="1.5">
          <path d="M70 130 L330 55 L330 205 Z" fill={c.accent} opacity="0.10" stroke="none" />
          <path d="M70 130 L330 55 M70 130 L330 205" stroke={c.accent} opacity="0.7" />
          <rect x="52" y="112" width="30" height="36" rx="5" fill={c.accent} opacity="0.9" stroke="none" />
          {[0, 1, 2, 3].map((i) => {
            const x = 190 + i * 47;
            const h = 40 + i * 22;
            return <line key={i} x1={x} y1={130 - h / 2} x2={x} y2={130 + h / 2} stroke={c.ink} opacity={0.55 - i * 0.1} />;
          })}
          {[0, 1, 2].map((i) => (
            <ellipse key={i} cx={330} cy={130} rx={6 + i * 5} ry={70 + i * 4}
                     stroke={c.ink} opacity={0.14} />
          ))}
        </g>
      );
  }
}

export default function CourseCover({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const motif = useMemo(() => motifFor(title), [title]);
  const c = THEME[motif];
  const id = motif; // gradient ids only need to be unique per motif

  return (
    <svg
      viewBox="0 0 400 260"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label={`${title} cover`}
    >
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.from} />
          <stop offset="100%" stopColor={c.to} />
        </linearGradient>
        <radialGradient id={`glow-${id}`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor={c.accent} stopOpacity="0.22" />
          <stop offset="100%" stopColor={c.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="260" fill={`url(#bg-${id})`} />
      <rect width="400" height="260" fill={`url(#glow-${id})`} />

      {/* Faint grid, so the motif sits on something rather than floating. */}
      <g stroke={c.ink} strokeWidth="0.5" opacity="0.06">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="260" />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 52} x2="400" y2={i * 52} />
        ))}
      </g>

      <Motif motif={motif} c={c} />
    </svg>
  );
}
