import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  CampaignChannel,
  CampaignStatus,
  Course,
  MarketingCampaign,
  MarketingPost,
} from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Check,
  Copy,
  Linkedin,
  Loader2,
  Mail,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';

const STATUSES: CampaignStatus[] = ['draft', 'approved', 'scheduled', 'published', 'archived'];

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  approved: 'bg-blue-500/10 text-blue-600',
  scheduled: 'bg-amber-500/10 text-amber-600',
  published: 'bg-green-500/10 text-green-600',
  archived: 'bg-muted text-muted-foreground line-through',
};

export default function MarketingManager() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [postsByCampaign, setPostsByCampaign] = useState<Record<string, MarketingPost[]>>({});
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    channel: 'linkedin' as CampaignChannel,
    course_id: '',
    objective: '',
    audience: '',
  });

  useEffect(() => {
    void fetchAll();
  }, []);

  const fetchAll = async () => {
    const [campaignsRes, coursesRes, postsRes] = await Promise.all([
      supabase.from('marketing_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('courses').select('*').order('title'),
      supabase.from('marketing_posts').select('*').order('variant'),
    ]);

    setCampaigns((campaignsRes.data ?? []) as MarketingCampaign[]);
    setCourses((coursesRes.data ?? []) as Course[]);

    const grouped: Record<string, MarketingPost[]> = {};
    for (const post of (postsRes.data ?? []) as MarketingPost[]) {
      (grouped[post.campaign_id] ??= []).push(post);
    }
    setPostsByCampaign(grouped);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    const { error } = await supabase.from('marketing_campaigns').insert({
      name: form.name,
      channel: form.channel,
      course_id: form.course_id || null,
      objective: form.objective || null,
      audience: form.audience || null,
    });

    if (error) {
      toast({ title: 'Could not create campaign', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Campaign created' });
      setDialogOpen(false);
      setForm({ name: '', channel: 'linkedin', course_id: '', objective: '', audience: '' });
      await fetchAll();
    }
    setSaving(false);
  };

  const handleGenerate = async (campaign: MarketingCampaign) => {
    setGeneratingId(campaign.id);
    try {
      // The generator runs as a Vercel serverless route (that is where the Groq
      // key lives), so this is a plain fetch rather than a Supabase function
      // invoke. The route re-checks the admin role from this token.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error('Your session expired. Sign in again.');

      const response = await fetch('/api/generate-marketing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          campaign_id: campaign.id,
          channel: campaign.channel,
          course_id: campaign.course_id,
          objective: campaign.objective,
          audience: campaign.audience,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error ?? `Generation failed (${response.status})`);
      }

      toast({ title: 'Drafts ready', description: 'Three variants generated.' });
      await fetchAll();
    } catch (error: any) {
      toast({
        title: 'Could not generate drafts',
        description: error.message ?? String(error),
        variant: 'destructive',
      });
    }
    setGeneratingId(null);
  };

  const updateCampaign = async (id: string, patch: Partial<MarketingCampaign>) => {
    const { error } = await supabase.from('marketing_campaigns').update(patch).eq('id', id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      await fetchAll();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign and its drafts?')) return;
    const { error } = await supabase.from('marketing_campaigns').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Campaign deleted' });
      await fetchAll();
    }
  };

  const selectVariant = async (post: MarketingPost) => {
    // Exactly one variant per campaign is the chosen one.
    await supabase
      .from('marketing_posts')
      .update({ is_selected: false })
      .eq('campaign_id', post.campaign_id);
    await supabase.from('marketing_posts').update({ is_selected: true }).eq('id', post.id);
    await fetchAll();
  };

  const copy = async (post: MarketingPost) => {
    const text = post.subject ? `${post.subject}\n\n${post.body}` : post.body;
    const withTags =
      post.hashtags.length > 0
        ? `${text}\n\n${post.hashtags.map((t) => `#${t}`).join(' ')}`
        : text;
    await navigator.clipboard.writeText(withTags);
    toast({ title: 'Copied to clipboard' });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Draft posts and emails with the AI agent, pick a variant, then track how it did.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Sparkles className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No campaigns yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create one, and the agent will draft three variants you can choose between.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const posts = postsByCampaign[campaign.id] ?? [];
            const course = courses.find((c) => c.id === campaign.course_id);

            return (
              <Card key={campaign.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {campaign.channel === 'linkedin' ? (
                          <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                        ) : (
                          <Mail className="h-4 w-4 text-primary" />
                        )}
                        <CardTitle className="text-base">{campaign.name}</CardTitle>
                        <Badge className={STATUS_STYLE[campaign.status]} variant="outline">
                          {campaign.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {course ? course.title : 'Platform-wide'}
                        {campaign.objective ? ` — ${campaign.objective}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={campaign.status}
                        onValueChange={(value) =>
                          updateCampaign(campaign.id, { status: value as CampaignStatus })
                        }
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleGenerate(campaign)}
                        disabled={generatingId === campaign.id}
                      >
                        {generatingId === campaign.id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Writing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            {posts.length > 0 ? 'Regenerate' : 'Generate'}
                          </>
                        )}
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleDelete(campaign.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {posts.length > 0 && (
                    <div className="grid gap-3 lg:grid-cols-3">
                      {posts.map((post) => (
                        <div
                          key={post.id}
                          className={`flex flex-col rounded-xl border p-4 transition-colors ${
                            post.is_selected ? 'border-primary bg-primary/5' : 'bg-muted/30'
                          }`}
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              Variant {post.variant}
                            </span>
                            {post.is_selected && (
                              <Badge variant="default" className="gap-1 text-xs">
                                <Check className="h-3 w-3" />
                                Chosen
                              </Badge>
                            )}
                          </div>

                          {post.subject && (
                            <p className="mb-2 text-sm font-semibold">{post.subject}</p>
                          )}

                          <p className="flex-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                            {post.body}
                          </p>

                          {post.hashtags.length > 0 && (
                            <p className="mt-2 text-xs text-primary">
                              {post.hashtags.map((t) => `#${t}`).join(' ')}
                            </p>
                          )}

                          {post.hook && (
                            <p className="mt-3 border-t pt-2 text-xs italic text-muted-foreground">
                              {post.hook}
                            </p>
                          )}

                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => copy(post)}
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              Copy
                            </Button>
                            {!post.is_selected && (
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => selectVariant(post)}
                              >
                                Choose
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Outcome tracking. The agent cannot know these — you fill them in. */}
                  <div className="grid grid-cols-3 gap-3 border-t pt-4">
                    {(['impressions', 'clicks', 'signups'] as const).map((metric) => (
                      <div key={metric} className="space-y-1">
                        <Label className="text-xs capitalize text-muted-foreground">
                          {metric}
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          className="h-8"
                          value={campaign[metric]}
                          onChange={(e) =>
                            updateCampaign(campaign.id, {
                              [metric]: Number(e.target.value) || 0,
                            } as Partial<MarketingCampaign>)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              The more specific the objective and audience, the less generic the copy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="July launch — AV perception"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Channel</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm({ ...form, channel: v as CampaignChannel })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Course</Label>
                <Select
                  value={form.course_id || 'none'}
                  onValueChange={(v) => setForm({ ...form, course_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Platform-wide" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Platform-wide</SelectItem>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Objective</Label>
              <Input
                value={form.objective}
                onChange={(e) => setForm({ ...form, objective: e.target.value })}
                placeholder="Fill the September cohort"
              />
            </div>

            <div className="space-y-2">
              <Label>Audience</Label>
              <Textarea
                rows={2}
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                placeholder="Mid-career CV engineers moving into AV perception"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
