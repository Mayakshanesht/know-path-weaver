import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Copy, Download, Loader2, Pause, Play, Plus, RefreshCw, Search, Ticket, Users } from 'lucide-react';
import CouponCheckoutsManager from './CouponCheckoutsManager';
import {
  DEFAULT_SPONSORSHIP_CAMPAIGN,
  parseTeamImport,
  sponsorshipCsv,
  sponsorshipInstructions,
  sponsorshipParams,
  type SponsorshipAudience,
  type SponsorshipCreateParams,
  type SponsorshipDraft,
} from '@/lib/sponsorshipAdmin';

interface SponsorshipCode {
  id: string;
  code: string;
  label: string;
  campaign: string;
  audience: SponsorshipAudience;
  team_name: string | null;
  max_redemptions: number;
  allowed_emails: string[] | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  discount_percent: number;
}

interface SponsorshipRedemption {
  id: string;
  code_id: string;
  user_id: string;
  full_name: string;
  email: string;
  team_name: string | null;
  college: string | null;
  redeemed_at: string;
  campaign?: string;
  audience?: SponsorshipAudience;
  code_label?: string;
  coupon_code?: string;
  discount_percent?: number;
}

interface ImportRow {
  params: SponsorshipCreateParams;
  requestId: string;
  code?: SponsorshipCode;
  error?: string;
}

// These tables and RPCs are added by the sponsorship migration.
const adminRpc = supabase.rpc.bind(supabase) as unknown as (
  name: 'admin_create_sponsorship_code' | 'admin_set_sponsorship_code_active',
  params: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

async function fetchAll<T>(table: 'sponsorship_codes' | 'sponsorship_redemptions', dateColumn: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from(table as never).select('*')
      .order(dateColumn, { ascending: false }).order('id', { ascending: false }).range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function createCode(params: SponsorshipCreateParams, requestId: string): Promise<SponsorshipCode> {
  const { data, error } = await adminRpc('admin_create_sponsorship_code', { ...params, p_request_id: requestId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object' || !('id' in row) || !('code' in row)) {
    throw new Error('The server did not return the code. Refresh the list before creating another invitation.');
  }
  return row as SponsorshipCode;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', sponsorshipCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const dateLabel = (date: string | null) => date ? new Date(date).toLocaleString() : 'No deadline';
const freshDraft = (): SponsorshipDraft => ({
  label: '', campaign: DEFAULT_SPONSORSHIP_CAMPAIGN, audience: 'team',
  teamName: '', seats: '35', emails: '', expiresAt: '', discountPercent: '100',
});

export default function SponsorshipManager() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<SponsorshipCode[]>([]);
  const [redemptions, setRedemptions] = useState<SponsorshipRedemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<SponsorshipDraft>(freshDraft);
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  const [latest, setLatest] = useState<SponsorshipCode | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [redemptionSearch, setRedemptionSearch] = useState('');
  const [selectedCodeId, setSelectedCodeId] = useState('all');
  const [bulkCsv, setBulkCsv] = useState('');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [bulkError, setBulkError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [newCodes, newRedemptions] = await Promise.all([
        fetchAll<SponsorshipCode>('sponsorship_codes', 'created_at'),
        fetchAll<SponsorshipRedemption>('sponsorship_redemptions', 'redeemed_at'),
      ]);
      setCodes(newCodes);
      setRedemptions(newRedemptions);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load sponsorship records.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const claim of redemptions) result.set(claim.code_id, (result.get(claim.code_id) ?? 0) + 1);
    return result;
  }, [redemptions]);
  const codesById = useMemo(() => new Map(codes.map((code) => [code.id, code])), [codes]);
  const codeStatus = (code: SponsorshipCode) => {
    if (!code.active) return 'paused';
    if (code.expires_at && new Date(code.expires_at).getTime() <= Date.now()) return 'expired';
    if ((counts.get(code.id) ?? 0) >= code.max_redemptions) return 'full';
    return 'active';
  };
  const visibleCodes = codes.filter((code) =>
    [code.label, code.code, code.campaign, code.team_name, code.audience].join(' ').toLowerCase().includes(search.toLowerCase())
    && (status === 'all' || codeStatus(code) === status));
  const visibleRedemptions = redemptions.filter((claim) => {
    const code = codesById.get(claim.code_id);
    return (selectedCodeId === 'all' || selectedCodeId === claim.code_id)
      && [claim.full_name, claim.email, claim.team_name, claim.college, claim.campaign ?? code?.campaign, claim.code_label ?? code?.label]
        .join(' ').toLowerCase().includes(redemptionSearch.toLowerCase());
  });

  const notifyError = (title: string, error: unknown) => toast({
    title, description: error instanceof Error ? error.message : String(error), variant: 'destructive',
  });
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: 'Clipboard is unavailable', description: 'Select the code and copy it manually.', variant: 'destructive' });
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const params = sponsorshipParams({
        ...draft,
        label: draft.label.trim() || (draft.audience === 'individual' ? draft.emails.trim() : draft.teamName.trim()),
        teamName: draft.audience === 'individual' ? '' : draft.teamName,
      });
      const fingerprint = JSON.stringify(params);
      if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      const code = await createCode(params, request.current.id);
      setLatest(code);
      setDraft((previous) => ({ ...freshDraft(), audience: previous.audience, seats: previous.seats,
        campaign: previous.campaign, expiresAt: previous.expiresAt, discountPercent: previous.discountPercent }));
      request.current = null;
      toast({ title: 'Sponsorship code created', description: 'Copy the student instructions and share with the assigned team or recipient.' });
      await refresh();
    } catch (error) { notifyError('Could not create the code', error); }
    finally { setBusy(false); }
  };

  const toggleActive = async (code: SponsorshipCode) => {
    setBusy(true);
    try {
      const { error } = await adminRpc('admin_set_sponsorship_code_active', { p_code_id: code.id, p_active: !code.active });
      if (error) throw new Error(error.message);
      toast({ title: code.active ? 'New claims paused' : 'New claims resumed', description: 'Previously claimed course access continues.' });
      await refresh();
    } catch (error) { notifyError('Could not update the code', error); }
    finally { setBusy(false); }
  };

  const previewImport = () => {
    try {
      const rows = parseTeamImport(bulkCsv, draft.campaign, draft.expiresAt, draft.discountPercent);
      const existingLabels = new Set(codes.filter((code) => code.campaign.toLowerCase() === draft.campaign.trim().toLowerCase()).map((code) => code.label.toLowerCase()));
      const duplicate = rows.find((row) => existingLabels.has(row.p_label.toLowerCase()));
      if (duplicate) throw new Error(`“${duplicate.p_label}” already exists in this campaign. Remove that row or choose a distinct label.`);
      setImportRows(rows.map((params) => ({ params, requestId: crypto.randomUUID() })));
      setBulkError('');
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : 'Unable to read the CSV.');
      setImportRows([]);
    }
  };

  const runImport = async () => {
    setBusy(true);
    const result = [...importRows];
    let succeeded = 0;
    try {
      for (let i = 0; i < result.length; i++) {
        if (result[i].code) continue;
        try {
          const code = await createCode(result[i].params, result[i].requestId);
          result[i] = { ...result[i], code, error: undefined };
          succeeded++;
        } catch (error) {
          result[i] = { ...result[i], error: error instanceof Error ? error.message : 'Creation failed.' };
          // Stop on failure; preserve every row and its idempotency key for retry.
          setImportRows([...result]);
          break;
        }
        setImportRows([...result]);
      }
      toast({ title: `${succeeded} team code${succeeded === 1 ? '' : 's'} created`, description: result.some((row) => row.error) ? 'Review the failed row below. Retry keeps completed codes and prevents duplicate creation.' : 'Copy instructions from the codes list for each team.' });
      await refresh();
    } finally { setBusy(false); }
  };

  const exportCodes = () => downloadCsv('knowgraph-sponsorship-codes.csv', [
    ['label', 'campaign', 'audience', 'team', 'code', 'discount_percent', 'seat_limit', 'claimed', 'remaining', 'status', 'claim_deadline', 'allowed_emails', 'created_at'],
    ...visibleCodes.map((code) => [code.label, code.campaign, code.audience, code.team_name, code.code, code.discount_percent ?? 100, code.max_redemptions, counts.get(code.id) ?? 0,
      Math.max(0, code.max_redemptions - (counts.get(code.id) ?? 0)), codeStatus(code), code.expires_at, code.allowed_emails?.join('; '), code.created_at]),
  ]);
  const exportRedemptions = () => downloadCsv('knowgraph-sponsorship-participants.csv', [
    ['full_name', 'email', 'team', 'college', 'campaign', 'audience', 'code_label', 'coupon_code', 'discount_percent', 'redeemed_at', 'user_id'],
    ...visibleRedemptions.map((claim) => {
      const code = codesById.get(claim.code_id);
      return [claim.full_name, claim.email, claim.team_name, claim.college, claim.campaign ?? code?.campaign,
        claim.audience ?? code?.audience, claim.code_label ?? code?.label, claim.coupon_code ?? code?.code, claim.discount_percent ?? code?.discount_percent ?? 100, claim.redeemed_at, claim.user_id];
    }),
  ]);

  const restrictedEmailCount = draft.emails.split(/[;,\s]+/).filter(Boolean).length;
  const advancedSummary = [
    draft.audience !== 'individual' && restrictedEmailCount ? `${restrictedEmailCount} allowed email${restrictedEmailCount === 1 ? '' : 's'}` : '',
    draft.expiresAt ? 'Deadline set' : '',
    draft.campaign !== DEFAULT_SPONSORSHIP_CAMPAIGN ? 'Custom campaign' : '',
    draft.label.trim() ? 'Custom label' : '',
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Coupons</h2><p className="text-sm text-muted-foreground">{loading ? 'Loading…' : `${codes.length} coupons · ${new Set(redemptions.map(claim => claim.user_id)).size} members with claims`}</p></div>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>
      {loadError && <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">Coupons could not be loaded: {loadError}. Refresh to try again.</div>}

      <Card>
        <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><Ticket className="h-5 w-5" />Create a coupon</CardTitle><CardDescription>One code for the whole team. Each member uses their own verified account.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate}>
            <fieldset disabled={busy || loading || !!loadError} className="min-w-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2"><Label htmlFor="sponsor-audience">Coupon for</Label><Select value={draft.audience} onValueChange={(value: SponsorshipAudience) => setDraft({ ...draft, audience: value, seats: value === 'individual' ? '1' : draft.seats === '1' ? '35' : draft.seats })}><SelectTrigger id="sponsor-audience"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="team">aBAJA team</SelectItem><SelectItem value="committee">Technical committee</SelectItem><SelectItem value="individual">Individual</SelectItem><SelectItem value="general">General / other group</SelectItem></SelectContent></Select></div>
                {draft.audience === 'individual'
                  ? <div className="space-y-2"><Label htmlFor="sponsor-recipient">Recipient account email</Label><Input id="sponsor-recipient" type="email" required maxLength={254} placeholder="member@gmail.com" value={draft.emails} onChange={event => setDraft({ ...draft, emails: event.target.value })} /></div>
                  : <div className="space-y-2"><Label htmlFor="sponsor-team">{draft.audience === 'team' ? 'Team name' : draft.audience === 'committee' ? 'Committee name' : 'Group name'}</Label><Input id="sponsor-team" required maxLength={160} placeholder={draft.audience === 'team' ? 'e.g. Falcon Racing' : draft.audience === 'committee' ? 'e.g. aBAJA technical committee' : 'e.g. Robotics workshop'} value={draft.teamName} onChange={event => setDraft({ ...draft, teamName: event.target.value })} /></div>}
                <div className="grid grid-cols-2 gap-4 sm:col-span-2 lg:col-span-2">
                  <div className="space-y-2"><Label htmlFor="sponsor-seats">Members</Label><Input id="sponsor-seats" type="number" min={draft.audience === 'team' ? 5 : 1} max={draft.audience === 'team' ? 35 : draft.audience === 'individual' ? 1 : 5000} required readOnly={draft.audience === 'individual'} value={draft.seats} onChange={event => setDraft({ ...draft, seats: event.target.value })} /><p className="text-xs text-muted-foreground">{draft.audience === 'team' ? '5–35 per team' : draft.audience === 'individual' ? 'One person' : 'Up to 5,000 people'}</p></div>
                  <div className="space-y-2"><Label htmlFor="sponsor-discount">Discount (%)</Label><Input id="sponsor-discount" type="number" min="0.01" max="100" step="0.01" required value={draft.discountPercent} onChange={event => { setDraft({ ...draft, discountPercent: event.target.value }); setImportRows([]); }} /></div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{Number(draft.discountPercent) === 100 ? '100%: every member gets all published courses free.' : `${draft.discountPercent || '0'}%: discount on the selected course; the remaining balance is paid at checkout.`}</p>
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild><Button type="button" variant="ghost" size="sm" className="h-auto max-w-full justify-start gap-2 px-0 py-1 text-muted-foreground"><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} /><span>Advanced options</span><span className="truncate text-xs font-normal">{advancedSummary || 'Email restrictions & deadline'}</span></Button></CollapsibleTrigger>
                <CollapsibleContent className="pt-3"><div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label htmlFor="sponsor-label">Custom label (optional)</Label><Input id="sponsor-label" maxLength={160} placeholder="Uses the team name or recipient email" value={draft.label} onChange={event => setDraft({ ...draft, label: event.target.value })} /></div>
                    <div className="space-y-2"><Label htmlFor="sponsor-campaign">Campaign</Label><Input id="sponsor-campaign" required maxLength={160} value={draft.campaign} onChange={event => { setDraft({ ...draft, campaign: event.target.value }); setImportRows([]); }} /></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="sponsor-expiry">Claim deadline (optional)</Label><Input id="sponsor-expiry" type="datetime-local" value={draft.expiresAt} onChange={event => { setDraft({ ...draft, expiresAt: event.target.value }); setImportRows([]); }} /><p className="text-xs text-muted-foreground">Stops new claims after this date. Existing access continues.</p></div>
                  </div>
                  {draft.audience !== 'individual' && <div className="space-y-2"><Label htmlFor="sponsor-emails">Allowed account emails (optional)</Label><Textarea id="sponsor-emails" rows={3} placeholder="member1@gmail.com; member2@college.edu" value={draft.emails} onChange={event => setDraft({ ...draft, emails: event.target.value })} /><p className="text-xs text-muted-foreground">Only these verified account emails can use the code. Separate addresses with commas, semicolons, or new lines.</p></div>}
                </div></CollapsibleContent>
              </Collapsible>
              {draft.audience !== 'individual' && !draft.emails.trim() && <p className="text-xs text-muted-foreground">Share only with your intended members. Advanced options can restrict the code to their email addresses.</p>}
              <Button type="submit" className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />{busy ? 'Generating…' : 'Generate coupon'}</Button>
            </fieldset>
          </form>
          {latest && <div role="status" className="mt-5 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center gap-2"><p className="font-medium">Coupon ready for {latest.team_name || latest.label}</p><Badge variant="secondary">{latest.discount_percent ?? 100}% discount</Badge><span className="text-sm text-muted-foreground">{latest.max_redemptions} {latest.max_redemptions === 1 ? 'member' : 'members'}</span></div>
            <code className="block select-all break-all text-lg font-semibold tracking-wide">{latest.code}</code>
            <p className="text-sm text-muted-foreground">{latest.max_redemptions === 1 ? 'Share with the named recipient. They use their own verified account.' : 'Share this same code with all assigned members. Each uses their own verified account.'}</p>
            <div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => void copy(latest.code, 'Code')}><Copy className="mr-2 h-4 w-4" />Copy code</Button><Button type="button" size="sm" variant="outline" onClick={() => void copy(sponsorshipInstructions(latest), 'Instructions')}>Copy instructions</Button></div>
          </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-lg">Your coupons</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {codes.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Find or export coupons{status !== 'all' ? ` · ${status}` : ''}{search ? ' · search active' : ''}</summary><div className="mt-3 flex flex-wrap items-center gap-3"><div className="relative min-w-0 basis-full sm:flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search invitation codes" className="pl-9" placeholder="Search team, name or code" value={search} onChange={event => setSearch(event.target.value)} /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40" aria-label="Code status"><SelectValue /></SelectTrigger><SelectContent>{['all', 'active', 'paused', 'expired', 'full'].map(value => <SelectItem key={value} value={value}>{value === 'all' ? 'All statuses' : value[0].toUpperCase() + value.slice(1)}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" disabled={!visibleCodes.length} onClick={exportCodes}><Download className="mr-2 h-4 w-4" />Export CSV</Button><p className="basis-full text-xs text-muted-foreground">The export contains private coupon codes. Share one team's instructions at a time.</p></div></details>}
          {loading ? <p className="py-3 text-sm text-muted-foreground">Loading coupons…</p> : !visibleCodes.length ? <p className="py-3 text-sm text-muted-foreground">{loadError ? 'Coupons unavailable. Refresh to try again.' : codes.length ? 'No coupons match your search or status filter.' : 'No coupons yet. Create your first one above.'}</p> : <ul className="divide-y">{visibleCodes.map(code => <li key={code.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium">{code.team_name || code.label}</p><p className="mt-1 text-xs text-muted-foreground">{counts.get(code.id) ?? 0} / {code.max_redemptions} members claimed</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{code.discount_percent ?? 100}%</Badge>{codeStatus(code) !== 'active' && <Badge variant="outline">{codeStatus(code)}</Badge>}</div></div>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><code className="min-w-0 select-all break-all text-sm">{code.code}</code><div className="flex shrink-0 flex-wrap gap-2"><Button size="sm" variant="outline" aria-label={`Copy code for ${code.label}`} onClick={() => void copy(code.code, 'Code')}><Copy className="mr-2 h-3 w-3" />Copy code</Button><Button size="sm" variant="ghost" aria-label={`Copy instructions for ${code.label}`} onClick={() => void copy(sponsorshipInstructions(code), 'Instructions')}>Copy instructions</Button></div></div>
            <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Details & management</summary><div className="mt-3 space-y-2 rounded-lg border p-3"><p>{code.campaign} · {code.audience}</p><p>{Number(code.discount_percent ?? 100) === 100 ? 'All published courses sponsored' : 'Selected course · remaining balance payable'}</p><p>Claim deadline: {dateLabel(code.expires_at)}</p><p className="break-words">{code.allowed_emails ? `Allowed emails: ${code.allowed_emails.join('; ')}` : 'No email restriction. Anyone holding this code can claim an available seat with a verified account.'}</p><div className="flex flex-wrap gap-2 pt-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void toggleActive(code)}>{code.active ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}{code.active ? 'Pause new claims' : 'Resume new claims'}</Button><Button size="sm" variant="ghost" onClick={() => { setSelectedCodeId(code.id); setTrackingOpen(true); setTimeout(() => document.getElementById('sponsorship-participants')?.scrollIntoView({ behavior: 'smooth' }), 0); }}>View participants</Button></div><p>Pausing stops new claims. Existing course access continues.</p></div></details>
          </li>)}</ul>}
        </CardContent>
      </Card>

      <Collapsible open={trackingOpen} onOpenChange={setTrackingOpen} className="rounded-xl border">
        <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="h-auto w-full justify-between whitespace-normal p-4 text-left"><span className="flex items-center gap-2"><Users className="h-4 w-4 shrink-0" />Participants & payments</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${trackingOpen ? 'rotate-180' : ''}`} /></Button></CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 px-3 pb-3 sm:px-4 sm:pb-4">
      <Card id="sponsorship-participants">
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Participant tracking</CardTitle><CardDescription>For partial coupons, claiming a seat does not grant access; payment must complete. Verified account email, submitted name, team, college, and claim time for each successful sponsorship claim.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3"><Input className="min-w-52 flex-1" aria-label="Search participants" placeholder="Search name, email, team, or college" value={redemptionSearch} onChange={(event) => setRedemptionSearch(event.target.value)} /><Select value={selectedCodeId} onValueChange={setSelectedCodeId}><SelectTrigger className="w-60" aria-label="Filter participants by invitation"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All invitations</SelectItem>{codes.map((code) => <SelectItem key={code.id} value={code.id}>{code.label}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={!visibleRedemptions.length} onClick={exportRedemptions}><Download className="mr-2 h-4 w-4" />Export participants CSV</Button></div>
          <p className="text-sm text-muted-foreground">{visibleRedemptions.length} claim{visibleRedemptions.length === 1 ? '' : 's'} shown</p>
          <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Participant</TableHead><TableHead>Team / college</TableHead><TableHead>Campaign / invitation</TableHead><TableHead>Claimed</TableHead></TableRow></TableHeader><TableBody>
            {loading ? <TableRow><TableCell colSpan={4}>Loading participants…</TableCell></TableRow> : !visibleRedemptions.length ? <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{loadError ? 'Participant records unavailable.' : 'No participants match these filters.'}</TableCell></TableRow> : visibleRedemptions.map((claim) => <TableRow key={claim.id}><TableCell><p className="font-medium">{claim.full_name}</p><p className="text-xs text-muted-foreground">{claim.email}</p></TableCell><TableCell><p>{claim.team_name || '—'}</p><p className="text-xs text-muted-foreground">{claim.college || '—'}</p></TableCell><TableCell><p>{claim.campaign ?? codesById.get(claim.code_id)?.campaign ?? '—'}</p><p className="text-xs text-muted-foreground">{claim.code_label ?? codesById.get(claim.code_id)?.label ?? '—'}</p><p className="text-xs text-muted-foreground">{claim.discount_percent ?? codesById.get(claim.code_id)?.discount_percent ?? 100}% discount</p></TableCell><TableCell className="text-xs">{dateLabel(claim.redeemed_at)}</TableCell></TableRow>)}
          </TableBody></Table></div>
        </CardContent>
      </Card>
          <CouponCheckoutsManager />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={bulkOpen} onOpenChange={setBulkOpen} className="rounded-xl border">
        <CollapsibleTrigger asChild><Button type="button" variant="ghost" className="h-auto w-full justify-between p-4"><span>Bulk import</span><ChevronDown className={`h-4 w-4 transition-transform ${bulkOpen ? 'rotate-180' : ''}`} /></Button></CollapsibleTrigger>
        <CollapsibleContent><p className="px-6 pb-4 text-sm text-muted-foreground">Create codes for multiple teams from a CSV. The campaign and deadline in Advanced options apply; each row can set its own discount. Review every row before creating codes.</p>
        <CardContent className="space-y-4">
          <Label htmlFor="sponsor-bulk">Team CSV</Label>
          <Textarea id="sponsor-bulk" rows={5} className="font-mono text-xs" disabled={busy} placeholder={'label,team_name,seats,emails\nTeam 01,Example Racing,20,member1@gmail.com;member2@gmail.com\nTeam 02,Another Team,35,'} value={bulkCsv} onChange={(event) => { setBulkCsv(event.target.value); setImportRows([]); setBulkError(''); }} />
          <p className="text-xs text-muted-foreground">Required columns: label, team_name, seats. Optional: emails (use semicolons between emails), discount_percent. An omitted or blank percentage uses {draft.discountPercent || 'the form default'}%. Quote values containing commas. Every row is validated before creation.</p>
          {bulkError && <p role="alert" className="text-sm text-destructive">{bulkError}</p>}
          <Button variant="outline" onClick={previewImport} disabled={busy || loading || !!loadError || !bulkCsv.trim()}>Validate and preview teams</Button>
          {importRows.length > 0 && <div className="space-y-3">
            <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Label / team</TableHead><TableHead>Seats</TableHead><TableHead>Discount</TableHead><TableHead>Roster</TableHead><TableHead>Creation result</TableHead></TableRow></TableHeader><TableBody>{importRows.map((row) => <TableRow key={row.requestId}><TableCell>{row.params.p_label}<span className="block text-xs text-muted-foreground">{row.params.p_team_name}</span></TableCell><TableCell>{row.params.p_max_redemptions}</TableCell><TableCell>{row.params.p_discount_percent}%</TableCell><TableCell>{row.params.p_allowed_emails?.length ?? 'No restriction'}</TableCell><TableCell>{row.code ? <span className="select-all font-mono text-xs">{row.code.code}</span> : row.error ? <span className="text-destructive">{row.error}</span> : 'Ready'}</TableCell></TableRow>)}</TableBody></Table></div>
            <p className="text-xs text-muted-foreground">{importRows.filter((row) => row.code).length} of {importRows.length} created. Rows without a roster allow anyone holding that code to claim a seat. Retry keeps successful rows and reuses the original request for each remaining row.</p>
            <Button onClick={() => void runImport()} disabled={busy || importRows.every((row) => row.code)}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{importRows.some((row) => row.code || row.error) ? 'Create remaining team codes' : `Create ${importRows.length} team codes`}</Button>
          </div>}
        </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
