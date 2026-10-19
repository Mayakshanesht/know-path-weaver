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
import { Copy, Download, Loader2, Pause, Play, Plus, RefreshCw, Search, Ticket, Users } from 'lucide-react';
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
      toast({ title: 'Clipboard is unavailable', description: 'Select the code in the table and copy it manually.', variant: 'destructive' });
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const params = sponsorshipParams(draft);
      const fingerprint = JSON.stringify(params);
      if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, id: crypto.randomUUID() };
      const code = await createCode(params, request.current.id);
      setLatest(code);
      setDraft((previous) => ({ ...freshDraft(), campaign: previous.campaign, expiresAt: previous.expiresAt, discountPercent: previous.discountPercent }));
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold">Course coupons and sponsored access</h2><p className="text-sm text-muted-foreground">Choose a discount for aBAJA teams, the technical committee, individuals, or other groups. aBAJA full sponsorship defaults to 100%.</p></div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading || busy}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>
      {loadError && <div role="alert" className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">Sponsorship records could not be loaded: {loadError}. Apply the sponsorship database migration if these tables are missing, then refresh.</div>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Invitation codes</p><p className="text-2xl font-semibold">{loading ? '…' : codes.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Participants with claims</p><p className="text-2xl font-semibold">{loading ? '…' : new Set(redemptions.map((claim) => claim.user_id)).size}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Seats available for new claims</p><p className="text-2xl font-semibold">{loading ? '…' : codes.filter((code) => codeStatus(code) === 'active').reduce((total, code) => total + Math.max(0, code.max_redemptions - (counts.get(code.id) ?? 0)), 0)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" />Create an invitation code</CardTitle><CardDescription>One team code can cover 5–35 members. Use an email roster to reserve it for the intended people. Email verification establishes the account; the roster verifies eligibility.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <fieldset disabled={busy || loading || !!loadError} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="sponsor-label">Invitation label</Label><Input id="sponsor-label" required maxLength={160} placeholder="Team 01 — college / team name" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="sponsor-campaign">Campaign</Label><Input id="sponsor-campaign" required maxLength={160} value={draft.campaign} onChange={(event) => { setDraft({ ...draft, campaign: event.target.value }); setImportRows([]); }} /></div>
                <div className="space-y-2"><Label htmlFor="sponsor-audience">Audience</Label><Select value={draft.audience} onValueChange={(value: SponsorshipAudience) => setDraft({ ...draft, audience: value, seats: value === 'individual' ? '1' : draft.seats === '1' ? '35' : draft.seats })}><SelectTrigger id="sponsor-audience"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="team">aBAJA team</SelectItem><SelectItem value="committee">aBAJA technical committee</SelectItem><SelectItem value="individual">Individual invitation</SelectItem><SelectItem value="general">General / other group</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="sponsor-team">Team / committee name{draft.audience === 'team' ? ' (required)' : ' (optional)'}</Label><Input id="sponsor-team" maxLength={160} required={draft.audience === 'team'} value={draft.teamName} onChange={(event) => setDraft({ ...draft, teamName: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="sponsor-seats">Seat limit</Label><Input id="sponsor-seats" type="number" min={draft.audience === 'team' ? 5 : 1} max={draft.audience === 'team' ? 35 : draft.audience === 'individual' ? 1 : 5000} required value={draft.seats} onChange={(event) => setDraft({ ...draft, seats: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="sponsor-discount">Discount percentage</Label><Input id="sponsor-discount" type="number" min="0.01" max="100" step="0.01" required value={draft.discountPercent} onChange={(event) => { setDraft({ ...draft, discountPercent: event.target.value }); setImportRows([]); }} /><p className="text-xs text-muted-foreground">100% grants free access to all published courses. A lower percentage discounts only the course purchased; the remaining balance must be paid through Razorpay.</p></div>
                <div className="space-y-2"><Label htmlFor="sponsor-expiry">Claim deadline (optional, your local time)</Label><Input id="sponsor-expiry" type="datetime-local" value={draft.expiresAt} onChange={(event) => { setDraft({ ...draft, expiresAt: event.target.value }); setImportRows([]); }} /><p className="text-xs text-muted-foreground">Stops new claims after this date. Existing course access continues.</p></div>
              </div>
              <div className="space-y-2"><Label htmlFor="sponsor-emails">Allowed account emails {draft.audience === 'individual' ? '(required)' : '(recommended)'}</Label><Textarea id="sponsor-emails" rows={3} placeholder="member1@gmail.com; member2@college.edu" value={draft.emails} onChange={(event) => setDraft({ ...draft, emails: event.target.value })} /><p className="text-xs text-muted-foreground">Use the exact verified account email for each member. Separate addresses with commas, semicolons, or new lines. Google sign-in and verified email accounts are supported.</p></div>
              {!draft.emails.trim() && <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">Without an email roster, anyone who receives this code can claim a seat using a verified account. Share only with the assigned team or group.</p>}
              <Button type="submit"><Plus className="mr-2 h-4 w-4" />{busy ? 'Working…' : 'Generate coupon code'}</Button>
            </fieldset>
          </form>
          {latest && <div role="status" className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"><span className="text-sm">Created for {latest.label}:</span><code className="select-all break-all font-semibold">{latest.code}</code><Badge variant="secondary">{latest.discount_percent ?? 100}% discount</Badge><Button size="sm" variant="outline" onClick={() => void copy(sponsorshipInstructions(latest), 'Student instructions')}><Copy className="mr-2 h-4 w-4" />Copy student instructions</Button></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Bulk team setup</CardTitle><CardDescription>Prepare all approximately 28 teams in one CSV. The campaign, claim deadline, and default discount above apply to each team. A discount_percent column can override the percentage per row. No codes are created until you review the preview.</CardDescription></CardHeader>
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
      </Card>

      <Card>
        <CardHeader><CardTitle>Invitation codes</CardTitle><CardDescription>Pausing a code stops new claims and leaves existing access in place. Full sponsorship uses zero-collection receipts. Partial coupons appear on the paid course invoice with the discount and verified amount collected.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3"><div className="relative min-w-52 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search invitation codes" className="pl-9" placeholder="Search team, campaign, label, or code" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="w-40" aria-label="Code status"><SelectValue /></SelectTrigger><SelectContent>{['all', 'active', 'paused', 'expired', 'full'].map((value) => <SelectItem key={value} value={value}>{value === 'all' ? 'All statuses' : value[0].toUpperCase() + value.slice(1)}</SelectItem>)}</SelectContent></Select><Button variant="outline" disabled={!visibleCodes.length} onClick={exportCodes}><Download className="mr-2 h-4 w-4" />Export codes CSV</Button></div>
          <p className="text-xs text-muted-foreground">The codes export contains private invitation codes. Share individual instructions with each team.</p>
          <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Invitation</TableHead><TableHead>Code</TableHead><TableHead>Seats</TableHead><TableHead>Status / deadline</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>
            {loading ? <TableRow><TableCell colSpan={5}>Loading sponsorship records…</TableCell></TableRow> : visibleCodes.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{loadError ? 'Records unavailable. Refresh after resolving the error above.' : 'No invitation codes match. Create codes after the team roster is ready.'}</TableCell></TableRow> : visibleCodes.map((code) => <TableRow key={code.id}>
              <TableCell><p className="font-medium">{code.label}</p><Badge variant="secondary" className="my-1">{code.discount_percent ?? 100}% discount</Badge><p className="text-xs text-muted-foreground">{code.campaign} · {code.audience}</p>{code.team_name && <p className="text-xs text-muted-foreground">{code.team_name}</p>}<p className="text-xs text-muted-foreground">{Number(code.discount_percent ?? 100) === 100 ? 'All published courses sponsored' : 'Selected course · balance payable'}</p><p className="text-xs text-muted-foreground">{code.allowed_emails ? `${code.allowed_emails.length} allowed emails` : 'No email restriction'}</p></TableCell>
              <TableCell><code className="select-all whitespace-nowrap text-xs">{code.code}</code><Button size="icon" variant="ghost" aria-label={`Copy code for ${code.label}`} onClick={() => void copy(code.code, 'Code')}><Copy className="h-4 w-4" /></Button></TableCell>
              <TableCell><span className="whitespace-nowrap">{counts.get(code.id) ?? 0} / {code.max_redemptions} claimed</span></TableCell>
              <TableCell><Badge variant={codeStatus(code) === 'active' ? 'default' : 'secondary'}>{codeStatus(code)}</Badge><p className="mt-1 text-xs text-muted-foreground">{dateLabel(code.expires_at)}</p></TableCell>
              <TableCell><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void copy(sponsorshipInstructions(code), 'Student instructions')}>Copy instructions</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => void toggleActive(code)}>{code.active ? <Pause className="mr-1 h-3 w-3" /> : <Play className="mr-1 h-3 w-3" />}{code.active ? 'Pause' : 'Resume'}</Button><Button size="sm" variant="ghost" onClick={() => { setSelectedCodeId(code.id); document.getElementById('sponsorship-participants')?.scrollIntoView({ behavior: 'smooth' }); }}>Participants</Button></div></TableCell>
            </TableRow>)}
          </TableBody></Table></div>
        </CardContent>
      </Card>

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
    </div>
  );
}
