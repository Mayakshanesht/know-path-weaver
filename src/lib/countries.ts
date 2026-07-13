/**
 * ISO 3166-1 alpha-2 countries, for capturing where a purchase was made.
 *
 * Region drives both the price shown (price_india vs price_international) and how
 * the sale is treated at tax time, so it is derived from the country rather than
 * asked for separately -- two fields that must agree are two fields that can disagree.
 */

const RAW =
  'AF:Afghanistan|AL:Albania|DZ:Algeria|AD:Andorra|AO:Angola|AR:Argentina|AM:Armenia|AU:Australia|' +
  'AT:Austria|AZ:Azerbaijan|BH:Bahrain|BD:Bangladesh|BY:Belarus|BE:Belgium|BJ:Benin|BT:Bhutan|' +
  'BO:Bolivia|BA:Bosnia and Herzegovina|BW:Botswana|BR:Brazil|BN:Brunei|BG:Bulgaria|BF:Burkina Faso|' +
  'KH:Cambodia|CM:Cameroon|CA:Canada|CL:Chile|CN:China|CO:Colombia|CR:Costa Rica|HR:Croatia|CU:Cuba|' +
  'CY:Cyprus|CZ:Czechia|DK:Denmark|DO:Dominican Republic|EC:Ecuador|EG:Egypt|SV:El Salvador|EE:Estonia|' +
  'ET:Ethiopia|FI:Finland|FR:France|GE:Georgia|DE:Germany|GH:Ghana|GR:Greece|GT:Guatemala|HN:Honduras|' +
  'HK:Hong Kong|HU:Hungary|IS:Iceland|IN:India|ID:Indonesia|IR:Iran|IQ:Iraq|IE:Ireland|IL:Israel|' +
  'IT:Italy|CI:Ivory Coast|JM:Jamaica|JP:Japan|JO:Jordan|KZ:Kazakhstan|KE:Kenya|KW:Kuwait|KG:Kyrgyzstan|' +
  'LA:Laos|LV:Latvia|LB:Lebanon|LY:Libya|LT:Lithuania|LU:Luxembourg|MO:Macao|MG:Madagascar|MY:Malaysia|' +
  'MV:Maldives|MT:Malta|MU:Mauritius|MX:Mexico|MD:Moldova|MC:Monaco|MN:Mongolia|ME:Montenegro|MA:Morocco|' +
  'MZ:Mozambique|MM:Myanmar|NA:Namibia|NP:Nepal|NL:Netherlands|NZ:New Zealand|NI:Nicaragua|NG:Nigeria|' +
  'MK:North Macedonia|NO:Norway|OM:Oman|PK:Pakistan|PS:Palestine|PA:Panama|PY:Paraguay|PE:Peru|' +
  'PH:Philippines|PL:Poland|PT:Portugal|QA:Qatar|RO:Romania|RU:Russia|RW:Rwanda|SA:Saudi Arabia|' +
  'SN:Senegal|RS:Serbia|SG:Singapore|SK:Slovakia|SI:Slovenia|ZA:South Africa|KR:South Korea|ES:Spain|' +
  'LK:Sri Lanka|SE:Sweden|CH:Switzerland|TW:Taiwan|TZ:Tanzania|TH:Thailand|TN:Tunisia|TR:Turkey|' +
  'UG:Uganda|UA:Ukraine|AE:United Arab Emirates|GB:United Kingdom|US:United States|UY:Uruguay|' +
  'UZ:Uzbekistan|VE:Venezuela|VN:Vietnam|YE:Yemen|ZM:Zambia|ZW:Zimbabwe';

export interface Country {
  code: string;
  name: string;
}

export const COUNTRIES: Country[] = RAW.split('|').map((entry) => {
  const [code, name] = entry.split(':');
  return { code, name };
});

export type BillingRegion = 'india' | 'international';

/** The single source of truth for which price and tax treatment a buyer gets. */
export function regionForCountry(countryCode: string): BillingRegion {
  return countryCode === 'IN' ? 'india' : 'international';
}

/**
 * The state a GST invoice calls the "place of supply".
 *
 * For an online course sold to an unregistered person, the place of supply is the buyer's
 * location — and it decides the tax split. KnowGraph is registered in Maharashtra, so a
 * Maharashtra buyer pays CGST + SGST and everyone else in India pays IGST. There is no way
 * to work this out after the sale, so the form has to ask.
 */
export const SELLER_STATE = 'Maharashtra';

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;

export function countryName(code: string | null | undefined): string {
  if (!code) return 'Unknown';
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

/** Best-effort default from the browser, so most users never touch the dropdown. */
export function guessCountry(): string {
  try {
    const locale = new Intl.Locale(navigator.language);
    const region = locale.region;
    if (region && COUNTRIES.some((c) => c.code === region)) return region;
  } catch {
    // Intl.Locale is unavailable or the tag has no region; fall through.
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  if (tz.startsWith('Asia/Calcutta') || tz.startsWith('Asia/Kolkata')) return 'IN';
  return '';
}
