import { supabase } from '@/integrations/supabase/client';
import type { PostgrestError } from '@supabase/supabase-js';

export interface SponsorshipRedemption {
  redemption_id: string;
  enrolled_count: number;
  already_redeemed: boolean;
  campaign: string;
  team_name: string | null;
}

export interface SponsorshipQuote {
  course_id: string;
  title: string;
  list_price: number;
  discount_amount: number;
  total: number;
  currency: 'INR' | 'EUR';
  discount_percent: number;
  campaign: string;
  team_name: string | null;
  already_redeemed: boolean;
}

export async function quoteSponsorshipCode(code: string, courseId: string, region: 'india' | 'international' = 'india'): Promise<SponsorshipQuote> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: 'quote_sponsorship_code', args: { p_code: string; p_course_id: string; p_region: string }
  ) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;
  const { data, error } = await rpc('quote_sponsorship_code', { p_code: code.trim(), p_course_id: courseId, p_region: region });
  if (error) throw new Error(error.message);
  const quote = data as SponsorshipQuote | null;
  if (!quote || quote.course_id !== courseId || !Number.isFinite(Number(quote.total)) || Number(quote.total) < 0
    || !Number.isFinite(Number(quote.list_price)) || Number(quote.list_price) < 0
    || !Number.isFinite(Number(quote.discount_amount)) || Number(quote.discount_amount) < 0 || Number(quote.discount_amount) > Number(quote.list_price)
    || Math.abs(Number(quote.list_price) - Number(quote.discount_amount) - Number(quote.total)) > 0.001
    || !Number.isFinite(Number(quote.discount_percent)) || Number(quote.discount_percent) <= 0 || Number(quote.discount_percent) > 100
    || (Number(quote.discount_percent) === 100 ? Number(quote.total) !== 0 : Number(quote.total) <= 0)
    || !['INR', 'EUR'].includes(quote.currency)) {
    throw new Error('We could not confirm this discount. Apply your coupon again before enrolling.');
  }
  return quote;
}

// Keep this new RPC contract explicit until generated Supabase types are refreshed.
type SponsorshipRpc = (name: 'redeem_sponsorship_code', args: {
  p_code: string;
  p_full_name: string;
  p_college: string;
}) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;

export async function redeemSponsorshipCode(code: string, fullName: string, college: string): Promise<SponsorshipRedemption> {
  const rpc = supabase.rpc.bind(supabase) as unknown as SponsorshipRpc;
  const { data, error } = await rpc('redeem_sponsorship_code', {
    p_code: code.trim(),
    p_full_name: fullName.trim(),
    p_college: college.trim(),
  });
  if (error) throw new Error(error.message);
  const result = data as unknown as SponsorshipRedemption | null;
  if (!result?.redemption_id) throw new Error('We could not confirm your access. Please try again.');
  return result;
}
