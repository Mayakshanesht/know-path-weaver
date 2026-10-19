import { describe, expect, it } from 'vitest';
import { parseTeamImport, sponsorshipCsv, sponsorshipInstructions, sponsorshipParams, type SponsorshipDraft } from '@/lib/sponsorshipAdmin';

const draft = (overrides: Partial<SponsorshipDraft> = {}): SponsorshipDraft => ({
  label: 'Team 01', campaign: 'SAEINDIA 2027 aBAJA', audience: 'team', teamName: 'Racing Team',
  seats: '5', emails: '', expiresAt: '', discountPercent: '100', ...overrides,
});

describe('sponsorship invitation validation', () => {
  it('normalizes the roster and removes duplicate addresses before counting seats', () => {
    const result = sponsorshipParams(draft({ emails: ' First@Example.COM; first@example.com\nsecond@example.com ' }));
    expect(result.p_allowed_emails).toEqual(['first@example.com', 'second@example.com']);
    expect(result.p_expires_at).toBeNull();
    expect(result.p_discount_percent).toBe(100);
  });

  it.each(['0', '-1', '100.01', '50.001', '1e2', 'NaN', 'Infinity', ''])('rejects an invalid discount percentage: %s', (discountPercent) => {
    expect(() => sponsorshipParams(draft({ discountPercent }))).toThrow('Discount must');
  });

  it('accepts fractional discount percentages without rounding them into a different offer', () => {
    expect(sponsorshipParams(draft({ discountPercent: '12.50' })).p_discount_percent).toBe(12.5);
    expect(sponsorshipParams(draft({ discountPercent: '.01' })).p_discount_percent).toBe(0.01);
    expect(sponsorshipParams(draft({ discountPercent: undefined })).p_discount_percent).toBe(100);
  });

  it('enforces team seat bounds and team identification', () => {
    expect(() => sponsorshipParams(draft({ seats: '4' }))).toThrow('between 5 and 35');
    expect(() => sponsorshipParams(draft({ seats: '36' }))).toThrow('between 5 and 35');
    expect(() => sponsorshipParams(draft({ teamName: ' ' }))).toThrow('team name');
    expect(() => sponsorshipParams(draft({ seats: '5.5' }))).toThrow('whole number');
  });

  it('requires one assigned account email for individual invitations', () => {
    expect(() => sponsorshipParams(draft({ audience: 'individual', seats: '1' }))).toThrow('account email');
    expect(sponsorshipParams(draft({ audience: 'individual', seats: '1', emails: 'person@example.com', teamName: '' })).p_max_redemptions).toBe(1);
    expect(() => sponsorshipParams(draft({ audience: 'individual', seats: '2', emails: 'person@example.com' }))).toThrow('exactly one seat');
  });

  it('validates email addresses, roster capacity and claim deadlines', () => {
    expect(() => sponsorshipParams(draft({ emails: 'not-an-email' }))).toThrow('email list');
    expect(() => sponsorshipParams(draft({ audience: 'general', seats: '1', emails: 'one@example.com;two@example.com' }))).toThrow('more people');
    expect(() => sponsorshipParams(draft({ expiresAt: '2020-01-01T00:00' }))).toThrow('future');
    expect(() => sponsorshipParams(draft({ expiresAt: 'invalid' }))).toThrow('future');
    expect(sponsorshipParams(draft({ audience: 'committee', seats: '100' })).p_max_redemptions).toBe(100);
  });
});

describe('bulk team CSV', () => {
  it('reads quoted commas, escaped quotes, CRLF, and multiline rosters', () => {
    const rows = parseTeamImport('\uFEFFlabel,team_name,seats,emails\r\n"Team, 01","The ""Racers""",5,"one@example.com\r\ntwo@example.com"', 'SAEINDIA 2027 aBAJA', '');
    expect(rows).toHaveLength(1);
    expect(rows[0].p_label).toBe('Team, 01');
    expect(rows[0].p_team_name).toBe('The "Racers"');
    expect(rows[0].p_allowed_emails).toEqual(['one@example.com', 'two@example.com']);
  });

  it('rejects the whole import when a later row is invalid', () => {
    expect(() => parseTeamImport('label,team_name,seats\nTeam 01,Racing,5\nTeam 02,Other,36', 'Campaign', '')).toThrow('Row 3');
    expect(() => parseTeamImport('label,team_name,seats\nTeam 01,Racing,5\nteam 01,Other,5', 'Campaign', '')).toThrow('Duplicate label');
  });

  it('inherits the form discount unless a team row supplies its own percentage', () => {
    const rows = parseTeamImport('label,team_name,seats,discount_percent\nTeam 01,Racing,5,\nTeam 02,Other,5,12.5', 'Campaign', '', '75');
    expect(rows.map((row) => row.p_discount_percent)).toEqual([75, 12.5]);
    expect(parseTeamImport('label,team_name,seats\nTeam 01,Racing,5', 'Campaign', '')[0].p_discount_percent).toBe(100);
    expect(() => parseTeamImport('label,team_name,seats,discount_percent\nTeam 01,Racing,5,100\nTeam 02,Other,5,100.1', 'Campaign', '')).toThrow('Row 3: Discount');
  });

  it('rejects malformed CSV and unknown or missing columns', () => {
    expect(() => parseTeamImport('label,team_name,seats\n"Team,Racing,5', 'Campaign', '')).toThrow('unclosed quote');
    expect(() => parseTeamImport('label,seats\nTeam,5', 'Campaign', '')).toThrow('needs');
    expect(() => parseTeamImport('label,team_name,seats,unknown\nTeam,Racing,5,a', 'Campaign', '')).toThrow('Only');
    expect(() => parseTeamImport('label,team_name,seats\nTeam,Racing,5,extra', 'Campaign', '')).toThrow('Column count');
  });
});

describe('admin sharing and exports', () => {
  it('prevents spreadsheet formula execution, even with leading whitespace', () => {
    expect(sponsorshipCsv([['=HYPERLINK("https://example.com")', '  +cmd', '-1', '@SUM(1)', '\tformula', 'Normal "text"']]))
      .toBe('"\'=HYPERLINK(""https://example.com"")","\'  +cmd","\'-1","\'@SUM(1)","\'\tformula","Normal ""text"""');
  });

  it('provides the correct login and explains free access and the claim deadline', () => {
    const instructions = sponsorshipInstructions({ code: 'KG-SECRET', campaign: 'SAEINDIA 2027 aBAJA', team_name: 'Racing Team', allowed_emails: ['student@example.com'], expires_at: '2027-01-01T12:00:00Z' });
    expect(instructions).toContain('https://courses.knowgraphapp.com/login');
    expect(instructions).toContain('KG-SECRET');
    expect(instructions).toContain('No payment or card details');
    expect(instructions).toContain('does not end access');
    expect(instructions).toContain('exact email on the team/committee roster');
  });

  it('describes only the purchased course and remaining payment for a partial coupon', () => {
    const instructions = sponsorshipInstructions({ code: 'KG-PARTIAL', campaign: 'Community learning', team_name: null, allowed_emails: null, expires_at: null, audience: 'general', discount_percent: 25.5 });
    expect(instructions).toContain('25.5% discount');
    expect(instructions).toContain('pay the remaining balance through secure Razorpay checkout');
    expect(instructions).toContain('course you purchase');
    expect(instructions).not.toContain('Complete free enrollment');
    expect(instructions).not.toContain('All published KnowGraph courses');
    expect(instructions).not.toContain('No payment or card details');
    expect(instructions).toContain('https://www.knowgraphapp.com/start');
  });
});
