import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, FileText, HelpCircle, Loader2, Scissors, Sparkles } from 'lucide-react';

/**
 * The course improvement agent, from the admin side.
 *
 * It can do everything that has been done by hand: rename lessons from the evidence inside
 * them, write the description that opens a lesson, write a module overview, write quiz
 * questions, and split a bundled lesson into the separate pieces of work it contains.
 *
 * It PROPOSES; you accept. Nothing is written to a paid course without a human looking at
 * it — a plausible-but-wrong rename is worse than the placeholder it replaces, and a quiz
 * that marks a right answer wrong destroys trust in everything else on the platform.
 *
 * Quizzes it writes are created UNPUBLISHED, even once accepted.
 */

type Action = 'titles' | 'overviews' | 'quizzes' | 'structure';

interface Change {
  kind: 'module' | 'capsule';
  id: string;
  title: string;
  description: string;
  reason: string;
  currentTitle?: string;
}
interface Overview {
  module_id: string;
  title: string;
  body: string;
  moduleTitle?: string;
}
interface Question {
  type: 'mcq' | 'true_false';
  question: string;
  options: string[];
  correct: string;
  explanation: string;
}
interface QuizProposal {
  capsule_id: string;
  questions: Question[];
  capsuleTitle?: string;
}
interface SplitLesson {
  title: string;
  description: string;
  item_titles: string[];
}
interface Split {
  capsule_id: string;
  lessons: SplitLesson[];
  capsuleTitle?: string;
}

const ACTIONS: { key: Action; label: string; hint: string }[] = [
  {
    key: 'titles',
    label: 'Titles & descriptions',
    hint: 'Rename from the evidence, and open every lesson with what it is and why it comes here.',
  },
  {
    key: 'overviews',
    label: 'Module overviews',
    hint: 'A "what this module covers" lesson, showing how each module follows from the last.',
  },
  {
    key: 'quizzes',
    label: 'Quizzes',
    hint: 'Questions that test understanding, not recall. Created unpublished.',
  },
  {
    key: 'structure',
    label: 'Split bundled lessons',
    hint: 'Six notebooks behind one "Mark as Complete" become six lessons.',
  },
];

const KEYS = ['a', 'b', 'c', 'd'];

export default function CourseAssistant({
  courseId,
  courseTitle,
  open,
  onOpenChange,
  onApplied,
}: {
  courseId: string;
  courseTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}) {
  const { toast } = useToast();
  const [context, setContext] = useState('');
  const [actions, setActions] = useState<Set<Action>>(new Set<Action>(['titles', 'overviews']));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [applying, setApplying] = useState(false);

  const [changes, setChanges] = useState<Change[] | null>(null);
  const [overviews, setOverviews] = useState<Overview[]>([]);
  const [quizzes, setQuizzes] = useState<QuizProposal[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [skipped, setSkipped] = useState('');
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAction = (a: Action) =>
    setActions((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });

  const reset = () => {
    setChanges(null);
    setOverviews([]);
    setQuizzes([]);
    setSplits([]);
    setSkipped('');
  };

  const run = async () => {
    if (actions.size === 0) {
      toast({ title: 'Pick at least one thing to improve', variant: 'destructive' });
      return;
    }

    setRunning(true);
    setProgress('');
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Sign in again.');

      const { data: allModules } = await supabase
        .from('learning_paths')
        .select('id, title, capsules(id)')
        .eq('course_id', courseId)
        .order('order_index');
      if (!allModules?.length) throw new Error('This course has no modules yet.');

      // Groq allows 8000 tokens/min, counting input plus the completion reservation
      // together, so a large course cannot go in one request. Walk it in batches — and
      // batch by LESSON count, because one 20-lesson module is a far bigger prompt than
      // four 2-lesson ones. Quizzes produce much more output, so those batches shrink.
      const perBatch = actions.has('quizzes') ? 6 : 14;
      const batches: string[][] = [];
      let batch: string[] = [];
      let lessons = 0;
      for (const m of allModules) {
        const n = (m.capsules ?? []).length || 1;
        if (batch.length && lessons + n > perBatch) {
          batches.push(batch);
          batch = [];
          lessons = 0;
        }
        batch.push(m.id);
        lessons += n;
      }
      if (batch.length) batches.push(batch);

      const acc = {
        changes: [] as Change[],
        overviews: [] as Overview[],
        quizzes: [] as QuizProposal[],
        splits: [] as Split[],
        notes: [] as string[],
      };

      for (let i = 0; i < batches.length; i++) {
        setProgress(
          batches.length > 1 ? `Reading ${i + 1} of ${batches.length}...` : 'Reading the course...'
        );

        let attempt = 0;
        for (;;) {
          const response = await fetch('/api/improve-course', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              course_id: courseId,
              context,
              module_ids: batches[i],
              actions: [...actions],
            }),
          });
          const data = await response.json().catch(() => ({}));

          if (response.ok && data?.ok !== false) {
            acc.changes.push(...(data.changes ?? []));
            acc.overviews.push(...(data.overviews ?? []));
            acc.quizzes.push(...(data.quizzes ?? []));
            acc.splits.push(...(data.splits ?? []));
            if (data.skipped) acc.notes.push(data.skipped);
            break;
          }

          // Tokens-per-minute is a rolling budget; the cure is simply to wait it out.
          const rateLimited = /rate_limit|429|tokens per minute/i.test(String(data?.error ?? ''));
          if (rateLimited && attempt < 2) {
            attempt += 1;
            setProgress(`Rate limit — waiting 60s (${i + 1}/${batches.length})...`);
            await new Promise((r) => setTimeout(r, 60_000));
            continue;
          }
          throw new Error(data?.error ?? `Failed (${response.status})`);
        }
      }

      // Look up what each proposal replaces, so the reviewer sees a real diff.
      const [{ data: mods }, { data: caps }] = await Promise.all([
        supabase.from('learning_paths').select('id, title').eq('course_id', courseId),
        supabase.from('capsules').select('id, title'),
      ]);
      const nameOf = new Map<string, string>([
        ...(mods ?? []).map((m) => [m.id, m.title] as const),
        ...(caps ?? []).map((c) => [c.id, c.title] as const),
      ]);

      setChanges(acc.changes.map((c) => ({ ...c, currentTitle: nameOf.get(c.id) })));
      setOverviews(acc.overviews.map((o) => ({ ...o, moduleTitle: nameOf.get(o.module_id) })));
      setQuizzes(acc.quizzes.map((q) => ({ ...q, capsuleTitle: nameOf.get(q.capsule_id) })));
      setSplits(acc.splits.map((s) => ({ ...s, capsuleTitle: nameOf.get(s.capsule_id) })));
      setSkipped(acc.notes.join(' '));

      setAccepted(
        new Set([
          ...acc.changes.map((c) => c.id),
          ...acc.overviews.map((o) => `ov:${o.module_id}`),
          ...acc.quizzes.map((q) => `qz:${q.capsule_id}`),
          ...acc.splits.map((s) => `sp:${s.capsule_id}`),
        ])
      );

      const total =
        acc.changes.length + acc.overviews.length + acc.quizzes.length + acc.splits.length;
      if (total === 0) {
        toast({
          title: 'Nothing to change',
          description: 'Nothing here could be improved from the evidence available.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Could not analyse the course',
        description: error.message ?? String(error),
        variant: 'destructive',
      });
    }
    setProgress('');
    setRunning(false);
  };

  const apply = async () => {
    setApplying(true);
    try {
      for (const c of (changes ?? []).filter((x) => accepted.has(x.id))) {
        const { error } = await supabase
          .from(c.kind === 'module' ? 'learning_paths' : 'capsules')
          .update({ title: c.title, description: c.description || null })
          .eq('id', c.id);
        if (error) throw error;
      }

      for (const o of overviews.filter((x) => accepted.has(`ov:${x.module_id}`))) {
        const { data: siblings } = await supabase
          .from('capsules')
          .select('id, order_index')
          .eq('learning_path_id', o.module_id)
          .order('order_index');

        const { data: cap, error } = await supabase
          .from('capsules')
          .insert({
            learning_path_id: o.module_id,
            title: o.title,
            description: 'Start here.',
            order_index: 0,
          })
          .select('id')
          .single();
        if (error) throw error;

        await supabase.from('capsule_content').insert({
          capsule_id: cap.id,
          content_type: 'text',
          title: o.title,
          content_value: o.body,
          order_index: 0,
        });

        // An overview placed after the lessons it describes would be pointless.
        const ordered = [cap.id, ...(siblings ?? []).map((s) => s.id)];
        for (let i = 0; i < ordered.length; i++) {
          await supabase.from('capsules').update({ order_index: i }).eq('id', ordered[i]);
        }
      }

      for (const q of quizzes.filter((x) => accepted.has(`qz:${x.capsule_id}`))) {
        const { data: quiz, error } = await supabase
          .from('quizzes')
          .insert({
            course_id: courseId,
            capsule_id: q.capsule_id,
            title: `${q.capsuleTitle ?? 'Lesson'} — Check yourself`,
            quiz_type: 'quiz',
            is_graded: false,
            passing_score: 70,
            max_attempts: 3,
            order_index: 0,
            // Even once accepted, a quiz waits for an explicit publish.
            is_published: false,
          })
          .select('id')
          .single();
        if (error) throw error;

        await supabase.from('quiz_questions').insert(
          q.questions.map((x, i) => ({
            quiz_id: quiz.id,
            question_type: x.type,
            question_text: x.question,
            // Quiz.tsx reads mcq options as a key->label object and grades with
            // `userAnswer === correct_answer`, where userAnswer is the option KEY.
            options:
              x.type === 'mcq'
                ? Object.fromEntries(x.options.map((o, j) => [KEYS[j], o]))
                : null,
            correct_answer: x.correct,
            explanation: x.explanation,
            points: 1,
            order_index: i,
          }))
        );
      }

      for (const s of splits.filter((x) => accepted.has(`sp:${x.capsule_id}`))) {
        const { data: parent } = await supabase
          .from('capsules')
          .select('id, learning_path_id, order_index')
          .eq('id', s.capsule_id)
          .single();
        const { data: items } = await supabase
          .from('capsule_content')
          .select('id, title')
          .eq('capsule_id', s.capsule_id);
        const { data: done } = await supabase
          .from('progress')
          .select('user_id')
          .eq('capsule_id', s.capsule_id)
          .eq('is_completed', true);

        for (let i = 0; i < s.lessons.length; i++) {
          const lesson = s.lessons[i];
          let capsuleId = parent!.id;

          if (i === 0) {
            // Reuse the parent row, so its progress records survive untouched.
            await supabase
              .from('capsules')
              .update({ title: lesson.title, description: lesson.description })
              .eq('id', parent!.id);
          } else {
            const { data: created, error } = await supabase
              .from('capsules')
              .insert({
                learning_path_id: parent!.learning_path_id,
                title: lesson.title,
                description: lesson.description,
                order_index: parent!.order_index + i,
              })
              .select('id')
              .single();
            if (error) throw error;
            capsuleId = created.id;

            // They completed the bundle, so they have completed what came out of it.
            if (done?.length) {
              await supabase.from('progress').insert(
                done.map((p) => ({
                  user_id: p.user_id,
                  capsule_id: capsuleId,
                  is_completed: true,
                  watch_percentage: 100,
                  completed_at: new Date().toISOString(),
                }))
              );
            }
          }

          for (let j = 0; j < lesson.item_titles.length; j++) {
            const item = (items ?? []).find((x) => x.title === lesson.item_titles[j]);
            if (item) {
              await supabase
                .from('capsule_content')
                .update({ capsule_id: capsuleId, order_index: j })
                .eq('id', item.id);
            }
          }
        }
      }

      const n = accepted.size;
      toast({
        title: 'Applied',
        description: `${n} change${n === 1 ? '' : 's'} written. Any new quizzes are unpublished.`,
      });
      reset();
      onApplied();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Could not apply',
        description: error.message ?? String(error),
        variant: 'destructive',
      });
    }
    setApplying(false);
  };

  const hasResults = changes !== null;
  const total = (changes?.length ?? 0) + overviews.length + quizzes.length + splits.length;
  const allIds = () => [
    ...(changes ?? []).map((c) => c.id),
    ...overviews.map((o) => `ov:${o.module_id}`),
    ...quizzes.map((q) => `qz:${q.capsule_id}`),
    ...splits.map((s) => `sp:${s.capsule_id}`),
  ];

  const Item = ({
    id,
    icon,
    badge,
    children,
  }: {
    id: string;
    icon: React.ReactNode;
    badge: string;
    children: React.ReactNode;
  }) => (
    <label className="flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40">
      <Checkbox checked={accepted.has(id)} onCheckedChange={() => toggle(id)} className="mt-1" />
      <div className="min-w-0 flex-1">
        <Badge variant="outline" className="mb-1.5 gap-1 text-xs">
          {icon}
          {badge}
        </Badge>
        {children}
      </div>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Improve course content
          </DialogTitle>
          <DialogDescription>
            <strong>{courseTitle}</strong>. It reads what is actually inside each lesson, so most
            suggestions recover a real title rather than invent one. It proposes; nothing is
            written until you accept it.
          </DialogDescription>
        </DialogHeader>

        {!hasResults ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>What should it improve?</Label>
              <div className="grid gap-2">
                {ACTIONS.map((a) => (
                  <label
                    key={a.key}
                    className="flex cursor-pointer gap-3 rounded-xl border p-3 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={actions.has(a.key)}
                      onCheckedChange={() => toggleAction(a.key)}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.hint}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="context">Context (optional, but it helps)</Label>
              <Textarea
                id="context"
                rows={5}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={
                  'Anything the lesson files cannot tell it. For example:\n\n' +
                  'Module 3 is the RL block — PPO on MetaDrive, not gym.\n' +
                  'The Colab notebooks are the assessed work; the videos are optional.'
                }
              />
              <p className="text-xs text-muted-foreground">
                It is told to leave a lesson alone when it has no evidence for what that lesson
                contains — so it will not guess, and it will tell you what it skipped.
              </p>
            </div>

            <Button onClick={run} disabled={running} className="w-full">
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {progress || 'Reading the course...'}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyse and suggest
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {total === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center">
                <p className="font-medium">No changes proposed</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nothing here could be improved from the evidence. Add context and try again.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {total} suggestion{total === 1 ? '' : 's'} — {accepted.size} selected
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setAccepted(accepted.size === total ? new Set() : new Set(allIds()))
                    }
                  >
                    {accepted.size === total ? 'Deselect all' : 'Select all'}
                  </Button>
                </div>

                {(changes ?? []).map((c) => (
                  <Item
                    key={c.id}
                    id={c.id}
                    icon={<ArrowRight className="h-3 w-3" />}
                    badge={c.kind === 'module' ? 'Module' : 'Lesson'}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {c.currentTitle && (
                        <span className="text-muted-foreground line-through">{c.currentTitle}</span>
                      )}
                      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      <span className="font-medium">{c.title}</span>
                    </div>
                    {c.description && (
                      <p className="mt-1.5 text-sm text-muted-foreground">{c.description}</p>
                    )}
                    {c.reason && (
                      <p className="mt-1 text-xs italic text-muted-foreground">Evidence: {c.reason}</p>
                    )}
                  </Item>
                ))}

                {overviews.map((o) => (
                  <Item
                    key={o.module_id}
                    id={`ov:${o.module_id}`}
                    icon={<FileText className="h-3 w-3" />}
                    badge="New overview"
                  >
                    <p className="text-sm font-medium">
                      {o.title}
                      {o.moduleTitle && (
                        <span className="font-normal text-muted-foreground">
                          {' '}— leads {o.moduleTitle}
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {o.body}
                    </p>
                  </Item>
                ))}

                {quizzes.map((q) => (
                  <Item
                    key={q.capsule_id}
                    id={`qz:${q.capsule_id}`}
                    icon={<HelpCircle className="h-3 w-3" />}
                    badge={`Quiz — ${q.questions.length} questions`}
                  >
                    <p className="text-sm font-medium">{q.capsuleTitle}</p>
                    <div className="mt-2 space-y-2">
                      {q.questions.map((x, i) => (
                        <div key={i} className="rounded-lg bg-muted/50 p-2.5">
                          <p className="text-sm font-medium">{x.question}</p>
                          {x.type === 'mcq' ? (
                            <ul className="mt-1 space-y-0.5">
                              {x.options.map((o, j) => (
                                <li
                                  key={j}
                                  className={
                                    KEYS[j] === x.correct
                                      ? 'text-xs font-medium text-primary'
                                      : 'text-xs text-muted-foreground'
                                  }
                                >
                                  {KEYS[j]}. {o} {KEYS[j] === x.correct && '✓'}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs font-medium text-primary">
                              Answer: {x.correct} ✓
                            </p>
                          )}
                          <p className="mt-1.5 text-xs italic text-muted-foreground">
                            {x.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Created unpublished. Review in Admin → Quizzes, then publish.
                    </p>
                  </Item>
                ))}

                {splits.map((s) => (
                  <Item
                    key={s.capsule_id}
                    id={`sp:${s.capsule_id}`}
                    icon={<Scissors className="h-3 w-3" />}
                    badge={`Split into ${s.lessons.length}`}
                  >
                    <p className="text-sm">
                      <span className="text-muted-foreground line-through">{s.capsuleTitle}</span>
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {s.lessons.map((l, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">{l.title}</span>
                          <span className="text-muted-foreground"> — {l.description}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Progress carries over — anyone who completed the bundle keeps credit for all
                      of these.
                    </p>
                  </Item>
                ))}

                {skipped && (
                  <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                    <span className="font-medium">Left alone:</span> {skipped}
                  </p>
                )}
              </>
            )}

            <div className="flex gap-2 border-t pt-4">
              <Button onClick={apply} disabled={applying || accepted.size === 0}>
                {applying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  `Apply ${accepted.size} change${accepted.size === 1 ? '' : 's'}`
                )}
              </Button>
              <Button variant="outline" onClick={reset}>
                Back
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
