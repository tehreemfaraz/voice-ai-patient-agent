/**
 * U.S. state/territory codes accepted by the API, plus their full names.
 *
 * The full names exist because of the voice path: the brief's validation rule is "valid 2-letter
 * U.S. state abbreviation", but a caller speaks "Texas", not "T-X". Accepting the spoken name and
 * normalizing it to `TX` keeps the stored value spec-compliant while sparing the caller a re-prompt
 * for something they already answered correctly.
 */
const STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  newhampshire: 'NH',
  newjersey: 'NJ',
  newmexico: 'NM',
  newyork: 'NY',
  northcarolina: 'NC',
  northdakota: 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  rhodeisland: 'RI',
  southcarolina: 'SC',
  southdakota: 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  westvirginia: 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  districtofcolumbia: 'DC',
  washingtondc: 'DC',
  puertorico: 'PR',
};

export const US_STATE_CODES = Object.values(STATE_NAME_TO_CODE).filter(
  (code, index, all) => all.indexOf(code) === index,
);

/**
 * Resolves whatever the caller (or an API client) supplied to a canonical 2-letter code.
 * Returns `undefined` for blank input and the trimmed/upper-cased input for anything
 * unrecognized, so `@IsIn(US_STATE_CODES)` still produces the field-specific error message.
 */
export function toStateCode(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const byName =
    STATE_NAME_TO_CODE[trimmed.toLowerCase().replace(/[^a-z]/g, '')];
  return byName ?? trimmed.toUpperCase();
}
