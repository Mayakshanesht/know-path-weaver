/**
 * The GIFs/clips of real course output, used to market the courses.
 *
 * Screenshots of what a learner actually builds sell a course far better than a stock
 * animation does. These are globbed from src/assets/marketing rather than imported one by
 * one, so dropping a file in is the whole job — nothing here needs editing, and a file that
 * is missing simply does not render.
 */

// eager + query:url gives us the hashed public URL at build time, for whatever is present.
const files = import.meta.glob('@/assets/marketing/*.{gif,mp4,webm,png,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const byKey = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const key = path.split('/').pop()!.replace(/\.(gif|mp4|webm|png|jpe?g)$/i, '');
  byKey.set(key, url);
}

export interface MarketingClip {
  key: string;
  url: string;
  isVideo: boolean;
  title: string;
  caption: string;
  /** Substring matched against the course title, so a clip can head its own course page. */
  courseMatch?: string;
}

/**
 * What each clip is. The caption matters as much as the image: it has to say what the learner
 * is looking at and what they built, not "a visualisation".
 */
const CATALOGUE: Array<Omit<MarketingClip, 'url' | 'isVideo'>> = [
  {
    key: 'motion-planning',
    title: 'A planner deciding what to do next',
    caption:
      'A*, a finite-state behaviour planner and a lattice local planner, running together: the global route, the live behaviour state, and the trajectories the vehicle is choosing between.',
    courseMatch: 'Motion Planning',
  },
  {
    key: 'aeb',
    title: 'Emergency braking, judging a closing gap',
    caption:
      'Distance, relative speed, and the classifier\'s call — SAFE or BRAKE — with the brake value it commands. You train this model yourself, and you choose the threshold that decides between a rear-ending and a collision.',
    courseMatch: 'Advanced Driver Assistance',
  },
  {
    key: 'acc',
    title: 'Adaptive cruise control holding a gap',
    caption:
      'The PID controller you write, tracking a lead vehicle and keeping a safe following distance as it slows and speeds up — then losing it, and recovering.',
    courseMatch: 'Vehicle Dynamics',
  },
  {
    key: 'perception',
    title: 'Instance segmentation on real KITTI frames',
    caption:
      'Not "these pixels are car" but "this is car #1 and that is car #2" — which is what a planner needs in order to know how many things it has to avoid.',
    courseMatch: 'Perception',
  },
  {
    key: 'optical-flow',
    title: 'Optical flow — motion, straight from the pixels',
    caption:
      'RAFT on a KITTI sequence. Every pixel gets a motion vector, which is how a monocular camera can tell you something is moving and roughly how fast.',
  },
  {
    key: 'scene-prediction',
    title: 'Predicting where everything goes next',
    caption:
      'A planner has to act on where agents WILL be, not where they were. By the time you have braked, the pedestrian has moved.',
  },
];

/** Only the clips whose file is actually present. */
export const MARKETING_CLIPS: MarketingClip[] = CATALOGUE.flatMap((entry) => {
  const url = byKey.get(entry.key);
  if (!url) return [];
  return [{ ...entry, url, isVideo: /\.(mp4|webm)$/i.test(url) }];
});

/** The clip that belongs to a course, if there is one. */
export function clipForCourse(courseTitle: string | undefined): MarketingClip | undefined {
  if (!courseTitle) return undefined;
  return MARKETING_CLIPS.find(
    (c) => c.courseMatch && courseTitle.toLowerCase().includes(c.courseMatch.toLowerCase())
  );
}
