export type SponsorshipAudience = 'team' | 'committee' | 'individual' | 'general';

export interface SponsorshipDraft {
  label: string;
  campaign: string;
  audience: SponsorshipAudience;
  teamName: string;
  seats: string;
  emails: string;
  expiresAt: string;
  discountPercent: string;
}

export interface SponsorshipCreateParams {
  p_label: string;
  p_campaign: string;
  p_audience: SponsorshipAudience;
  p_team_name: string | null;
  p_max_redemptions: number;
  p_allowed_emails: string[] | null;
  p_expires_at: string | null;
  p_discount_percent: number;
}

export const DEFAULT_SPONSORSHIP_CAMPAIGN = 'SAEINDIA 2027 aBAJA';

export function sponsorshipParams(draft: SponsorshipDraft): SponsorshipCreateParams {
  const label = draft.label.trim();
  const campaign = draft.campaign.trim();
  const teamName = draft.teamName.trim();
  if (!label || label.length > 160) throw new Error('Enter a label of 1–160 characters.');
  if (!campaign || campaign.length > 160) throw new Error('Enter a campaign of 1–160 characters.');
  if (teamName.length > 160) throw new Error('Team name must be at most 160 characters.');
  if (draft.audience === 'team' && !teamName) throw new Error('Enter the team name.');
  const seats = Number(draft.seats);
  if (!/^\d+$/.test(draft.seats.trim()) || !Number.isSafeInteger(seats) || seats < 1 || seats > 5000) {
    throw new Error('Seat limit must be a whole number between 1 and 5,000.');
  }
  if (draft.audience === 'team' && (seats < 5 || seats > 35)) {
    throw new Error('For an aBAJA team, use a seat limit between 5 and 35.');
  }
  if (draft.audience === 'individual' && seats !== 1) {
    throw new Error('An individual invitation must have exactly one seat.');
  }
  const percentage = (draft.discountPercent ?? '100').trim();
  const discountPercent = Number(percentage);
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(percentage)
    || !Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    throw new Error('Discount must be greater than 0 and at most 100%, with up to two decimal places.');
  }
  const emails = [...new Set(draft.emails.split(/[;,\s]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
  if (emails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) {
    throw new Error('Check the email list. Separate complete addresses with commas, semicolons, or new lines.');
  }
  if (emails.length > seats) throw new Error('The email list contains more people than the seat limit.');
  if (draft.audience === 'individual' && emails.length !== 1) {
    throw new Error('An individual invitation needs the recipient’s account email.');
  }
  let expiry: string | null = null;
  if (draft.expiresAt) {
    const date = new Date(draft.expiresAt);
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      throw new Error('Choose a redemption deadline in the future, or leave it empty.');
    }
    expiry = date.toISOString();
  }
  return {
    p_label: label,
    p_campaign: campaign,
    p_audience: draft.audience,
    p_team_name: teamName || null,
    p_max_redemptions: seats,
    p_allowed_emails: emails.length ? emails : null,
    p_expires_at: expiry,
    p_discount_percent: discountPercent,
  };
}

// RFC 4180-style CSV, including quoted commas, escaped quotes, and multiline cells.
function readCsv(value: string): string[][] {
  const source = value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let quoteClosed = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; quoteClosed = true; }
      else cell += char;
    } else if (char === ',' || char === '\n') {
      row.push(cell.trim());
      cell = '';
      quoteClosed = false;
      if (char === '\n') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else if (char === '"') {
      if (cell || quoteClosed) throw new Error('A CSV quote must start a cell. Quote the entire value.');
      quoted = true;
    } else {
      if (quoteClosed && char.trim()) throw new Error('Unexpected text after a closing CSV quote.');
      if (!quoteClosed) cell += char;
    }
  }
  if (quoted) throw new Error('The CSV contains an unclosed quote.');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parseTeamImport(csv: string, campaign: string, expiresAt: string, discountPercent = '100'): SponsorshipCreateParams[] {
  const [header, ...rows] = readCsv(csv);
  if (!header || !rows.length) throw new Error('Add the header and at least one team row.');
  if (rows.length > 100) throw new Error('Import at most 100 teams at a time.');
  const columns = header.map((name) => name.trim().toLowerCase());
  if (new Set(columns).size !== columns.length) throw new Error('CSV column names must be unique.');
  if (['label', 'team_name', 'seats'].some((name) => !columns.includes(name))) {
    throw new Error('CSV needs label,team_name,seats columns, with optional emails and discount_percent columns.');
  }
  if (columns.some((name) => !['label', 'team_name', 'seats', 'emails', 'discount_percent'].includes(name))) {
    throw new Error('Only label,team_name,seats,emails,discount_percent columns are supported.');
  }
  const labels = new Set<string>();
  return rows.map((row, i) => {
    try {
      if (row.length !== columns.length) throw new Error('Column count does not match the header. Quote cells containing commas.');
      const field = (name: string) => row[columns.indexOf(name)] ?? '';
      const params = sponsorshipParams({
        label: field('label'), campaign, audience: 'team', teamName: field('team_name'),
        seats: field('seats'), emails: field('emails'), expiresAt,
        discountPercent: field('discount_percent') || discountPercent,
      });
      const key = params.p_label.toLowerCase();
      if (labels.has(key)) throw new Error(`Duplicate label “${params.p_label}”. Give every team a unique label.`);
      labels.add(key);
      return params;
    } catch (error) {
      throw new Error(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Invalid row.'}`);
    }
  });
}

export function sponsorshipCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map((value) => {
    let cell = String(value ?? '');
    // Quoting alone does not stop spreadsheet formula execution.
    if (/^\s*[=+\-@]|^[\t\r\n]/.test(cell)) cell = `'${cell}`;
    return `"${cell.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}

export function sponsorshipInstructions(code: { code: string; campaign: string; team_name: string | null; expires_at: string | null; allowed_emails: string[] | null; audience?: string; discount_percent?: number }): string {
  const percent = Number(code.discount_percent ?? 100);
  const fullySponsored = percent === 100;
  return [
    `${code.campaign} — ${fullySponsored ? 'free KnowGraph course access' : `${percent}% KnowGraph course discount`}`,
    code.team_name ? `For: ${code.team_name}` : '',
    '1. Open https://courses.knowgraphapp.com/signup, create your own account, and verify the email link. You can also Continue with Google.',
    '2. Sign in at https://courses.knowgraphapp.com/login using your own account' + (code.allowed_emails?.length ? ' with the exact email on the team/committee roster.' : '.'),
    `3. Open a course page and apply this sponsorship coupon: ${code.code}`,
    fullySponsored
      ? '4. Check the 100% discount and zero total. Enter your full name and college or organization, then select Complete free enrollment. Your assigned group is linked through the code.'
      : `4. Check the ${percent}% discount and remaining total for your selected course. Enter your full name and college or organization when asked, then pay the remaining balance through secure Razorpay checkout.`,
    fullySponsored
      ? 'Redeem this code once per member to unlock all published KnowGraph courses together, including future additions. No payment or card details are required.'
      : 'This coupon discounts the course you purchase. Access to that course starts after the remaining payment is verified. Other paid courses and subscriptions keep their own prices.',
    code.expires_at ? `Use your coupon before ${new Date(code.expires_at).toISOString()}. This is the coupon claim deadline; it does not end access you already claimed.` : '',
    '5. Install KnowGraph from https://www.knowgraphapp.com/get-app and sign in with the same verified email or Google account. Your course access works on the website and mobile app.',
    'Return using the same account. Your browser keeps you signed in unless you sign out or clear its data.',
    `Full instructions: https://www.knowgraphapp.com/${code.audience === 'committee' ? 'abaja-committee' : code.audience === 'team' ? 'abaja-students' : 'start'}`,
    'Keep this code within the assigned team or group. If your email is missing from the roster, ask the KnowGraph administrator before using a different account.',
  ].filter(Boolean).join('\n');
}
