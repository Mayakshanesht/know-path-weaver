import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, FlaskConical, Trophy } from 'lucide-react';

/**
 * The marketing syllabus: what a buyer needs to decide with.
 *
 * Replaces a whitespace-pre-wrap dump of a text field, which is how the page used to
 * render internal notes ("🔹 Module 0 — Foundations...") straight at prospective
 * customers. Kept separate from learning_paths/capsules on purpose — those answer
 * "what do I watch next", this answers "should I buy this".
 */

interface Syllabus {
  outcomes?: string[];
  modules?: { title: string; goal?: string; lectures?: string[] }[];
  projects?: { name: string; blurb?: string; capstone?: boolean }[];
  projects_note?: string;
}

export default function CourseSyllabus({ syllabus }: { syllabus: Syllabus | null }) {
  if (!syllabus) return null;

  const { outcomes = [], modules = [], projects = [], projects_note } = syllabus;
  if (!outcomes.length && !modules.length && !projects.length) return null;

  return (
    <div className="space-y-6">
      {outcomes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What you'll learn</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2">
              {outcomes.map((o) => (
                <li key={o} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="text-sm leading-relaxed">{o}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {modules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>The modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {modules.map((m, i) => (
              <div key={m.title} className="flex gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1 pb-4 border-b last:border-0 last:pb-0">
                  <p className="font-medium">{m.title}</p>
                  {m.goal && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{m.goal}</p>
                  )}
                  {m.lectures && m.lectures.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {m.lectures.map((l) => (
                        <li key={l} className="text-sm text-muted-foreground">
                          — {l}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              What you'll build
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects_note && (
              <p className="text-sm text-muted-foreground">{projects_note}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <div
                  key={p.name}
                  className={`rounded-xl border p-4 ${
                    p.capstone ? 'border-primary/40 bg-primary/5 sm:col-span-2' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {p.capstone && (
                      <Trophy className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {p.name}
                        {p.capstone && (
                          <Badge className="ml-2 text-xs" variant="default">
                            Capstone
                          </Badge>
                        )}
                      </p>
                      {p.blurb && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{p.blurb}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
