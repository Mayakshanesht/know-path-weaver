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
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';

/**
 * Proposes improved titles and descriptions for a course's modules and capsules.
 *
 * Every suggestion is reviewed before anything is written. This is paid content: a
 * model that renames "Video 3" to something plausible but wrong is worse than the
 * placeholder, because the placeholder at least admits it knows nothing.
 *
 * The agent is grounded in the content items actually inside each capsule — "Video 3"
 * holding a file titled "Support Vector Machines" is evidence — so most suggestions
 * are recovered fact rather than invention. Where there is no evidence, it is
 * instructed to leave the capsule alone, and those come back marked unchanged.
 */

interface Suggestion {
  id: string;
  title: string;
  description: string;
  changed: boolean;
  reason: string;
}

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
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [modules, setModules] = useState<Suggestion[] | null>(null);
  const [capsules, setCapsules] = useState<Suggestion[] | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const run = async () => {
    setRunning(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session expired. Sign in again.');

      const response = await fetch('/api/improve-course', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ course_id: courseId, context }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error ?? `Failed (${response.status})`);
      }

      const m: Suggestion[] = (data.modules ?? []).filter((s: Suggestion) => s.changed);
      const c: Suggestion[] = (data.capsules ?? []).filter((s: Suggestion) => s.changed);

      setModules(m);
      setCapsules(c);
      // Pre-ticked: the point is to review a diff, not to click 40 checkboxes.
      setAccepted(new Set([...m, ...c].map((s) => s.id)));

      if (m.length + c.length === 0) {
        toast({
          title: 'Nothing to change',
          description: 'The agent found no lesson it could improve from the evidence.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Could not analyse the course',
        description: error.message ?? String(error),
        variant: 'destructive',
      });
    }
    setRunning(false);
  };

  const apply = async () => {
    setApplying(true);
    try {
      const chosenModules = (modules ?? []).filter((s) => accepted.has(s.id));
      const chosenCapsules = (capsules ?? []).filter((s) => accepted.has(s.id));

      for (const s of chosenModules) {
        const { error } = await supabase
          .from('learning_paths')
          .update({ title: s.title, description: s.description || null })
          .eq('id', s.id);
        if (error) throw error;
      }

      for (const s of chosenCapsules) {
        const { error } = await supabase
          .from('capsules')
          .update({ title: s.title, description: s.description || null })
          .eq('id', s.id);
        if (error) throw error;
      }

      toast({
        title: 'Applied',
        description: `${chosenModules.length} module(s) and ${chosenCapsules.length} lesson(s) updated.`,
      });

      setModules(null);
      setCapsules(null);
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

  const hasResults = modules !== null && capsules !== null;
  const total = (modules?.length ?? 0) + (capsules?.length ?? 0);

  const Row = ({ s, kind }: { s: Suggestion; kind: 'Module' | 'Lesson' }) => (
    <label
      key={s.id}
      className="flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40"
    >
      <Checkbox
        checked={accepted.has(s.id)}
        onCheckedChange={() => toggle(s.id)}
        className="mt-1"
      />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {kind}
          </Badge>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground line-through">
            {kind === 'Module' ? 'current' : 'current'}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{s.title}</span>
        </p>
        {s.description && (
          <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
        )}
        {s.reason && (
          <p className="mt-1 text-xs italic text-muted-foreground">Evidence: {s.reason}</p>
        )}
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
            Proposes better titles and descriptions for <strong>{courseTitle}</strong>. It
            reads what is actually inside each lesson, so most suggestions recover a real
            title rather than invent one. Nothing is written until you accept it.
          </DialogDescription>
        </DialogHeader>

        {!hasResults ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="context">Context (optional, but it helps)</Label>
              <Textarea
                id="context"
                rows={7}
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder={
                  'Anything the lesson files do not say. For example:\n\n' +
                  'Module 3 is the RL block — PPO on MetaDrive, not gym.\n' +
                  '"Study Material" capsules are resource collections, not lessons.\n' +
                  'The Colab notebooks are the assessed work.'
                }
              />
              <p className="text-xs text-muted-foreground">
                The agent is told to leave a lesson alone when it has no evidence for what
                it contains — so it will not guess, and it will tell you what it skipped.
              </p>
            </div>

            <Button onClick={run} disabled={running} className="w-full">
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reading the course...
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
                  Nothing here could be improved from the evidence available. Add context
                  above and try again.
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
                      setAccepted(
                        accepted.size === total
                          ? new Set()
                          : new Set([...(modules ?? []), ...(capsules ?? [])].map((s) => s.id))
                      )
                    }
                  >
                    {accepted.size === total ? 'Deselect all' : 'Select all'}
                  </Button>
                </div>

                <div className="space-y-2">
                  {(modules ?? []).map((s) => (
                    <Row key={s.id} s={s} kind="Module" />
                  ))}
                  {(capsules ?? []).map((s) => (
                    <Row key={s.id} s={s} kind="Lesson" />
                  ))}
                </div>
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
              <Button
                variant="outline"
                onClick={() => {
                  setModules(null);
                  setCapsules(null);
                }}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
