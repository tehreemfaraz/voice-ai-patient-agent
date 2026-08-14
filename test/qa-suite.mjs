/**
 * QA suite for the Voice AI Patient Registration assessment.
 * Every test is tagged with the PDF section it verifies.
 */
// Read the same .env the server reads, so the suite's webhook secret can never drift from it.
import { readFileSync } from 'node:fs';

function envFromDotenv(key) {
  try {
    const line = readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split('\n')
      .find((l) => l.trim().startsWith(`${key}=`));
    return line?.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
  } catch {
    return undefined;
  }
}

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const SECRET =
  process.env.VAPI_SERVER_SECRET ?? envFromDotenv('VAPI_SERVER_SECRET');

if (!SECRET) {
  console.error('VAPI_SERVER_SECRET not found in env or .env — cannot exercise /voice/webhook.');
  process.exit(1);
}

let pass = 0;
const failures = [];
const notes = [];
const createdIds = [];

function check(name, cond, detail = '') {
  if (cond) {
    pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failures.push({ name, detail });
    console.log(`  \x1b[31m✗ ${name}\x1b[0m ${detail ? `— ${detail}` : ''}`);
  }
}
function note(text) {
  notes.push(text);
  console.log(`  \x1b[33m•\x1b[0m ${text}`);
}
function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function req(method, path, body, headers = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, body: json };
}

async function tool(name, args, id = 'call_test') {
  return req(
    'POST',
    '/voice/webhook',
    { message: { type: 'tool-calls', toolCallList: [{ id, type: 'function', function: { name, arguments: args } }] } },
    { 'x-vapi-secret': SECRET },
  );
}
function toolResult(res, idx = 0) {
  return JSON.parse(res.body.results[idx].result);
}

let phoneSeq = 0;
const nextPhone = () => `512${String(5550000 + phoneSeq++).padStart(7, '0')}`;
const validPatient = (over = {}) => ({
  first_name: 'Jane',
  last_name: 'Tester',
  date_of_birth: '1990-05-14',
  sex: 'Female',
  phone_number: nextPhone(),
  address_line_1: '123 Main St',
  city: 'Austin',
  state: 'TX',
  zip_code: '78701',
  ...over,
});
const errMsgs = (r) => {
  const m = r.body?.error?.message;
  return Array.isArray(m) ? m : [m];
};
const hasErrAbout = (r, field) => errMsgs(r).some((m) => typeof m === 'string' && m.includes(field));

// ─────────────────────────────────────────────────────────────
section('§4 Web Service — happy-path CRUD');

const created = await req('POST', '/patients', validPatient({ email: 'jane@example.com' }));
check('POST /patients returns 201', created.status === 201, `got ${created.status}`);
check('POST returns generated patient_id (UUID)', /^[0-9a-f-]{36}$/.test(created.body?.data?.patient_id ?? ''));
check('POST auto-generates created_at / updated_at', !!created.body?.data?.created_at && !!created.body?.data?.updated_at);
check('POST defaults preferred_language to "English"', created.body?.data?.preferred_language === 'English',
  `got ${created.body?.data?.preferred_language}`);
const id = created.body?.data?.patient_id;
if (id) createdIds.push(id);

const one = await req('GET', `/patients/${id}`);
check('GET /patients/:id returns 200 + the record', one.status === 200 && one.body?.data?.patient_id === id);

const list = await req('GET', '/patients');
check('GET /patients returns 200 + array', list.status === 200 && Array.isArray(list.body?.data));
check('GET /patients includes the new record', list.body?.data?.some((p) => p.patient_id === id));

const updated = await req('PUT', `/patients/${id}`, { city: 'Dallas' });
check('PUT /patients/:id partial update returns 200', updated.status === 200, `got ${updated.status}`);
check('PUT changes only the given field', updated.body?.data?.city === 'Dallas' && updated.body?.data?.first_name === 'Jane');
check('PUT bumps updated_at', updated.body?.data?.updated_at !== created.body?.data?.updated_at);

const del = await req('DELETE', `/patients/${id}`);
check('DELETE /patients/:id returns 200', del.status === 200, `got ${del.status}`);
check('DELETE is a SOFT delete (deleted_at set)', !!del.body?.data?.deleted_at);
const afterDel = await req('GET', `/patients/${id}`);
check('Soft-deleted record is hidden from GET /patients/:id (404)', afterDel.status === 404, `got ${afterDel.status}`);
const listAfterDel = await req('GET', '/patients');
check('Soft-deleted record is hidden from GET /patients', !listAfterDel.body?.data?.some((p) => p.patient_id === id));

// ─────────────────────────────────────────────────────────────
section('§4 API Standards — envelope + status codes');

check('Success envelope is { data, error:null }', 'data' in list.body && list.body.error === null);
const badId = await req('GET', '/patients/not-a-uuid');
check('GET with malformed UUID returns 400', badId.status === 400, `got ${badId.status}`);
const missing = await req('GET', '/patients/11111111-1111-1111-1111-111111111111');
check('GET unknown (valid) UUID returns 404', missing.status === 404, `got ${missing.status}`);
check('Error envelope is { data:null, error:{...} }', missing.body?.data === null && !!missing.body?.error);
const invalid = await req('POST', '/patients', validPatient({ state: 'ZZ' }));
check('POST failing a field rule returns 422 (parses, but unprocessable)', invalid.status === 422, `got ${invalid.status}`);
const malformed = await fetch(`${BASE}/patients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' });
check('POST with unparseable JSON returns 400 (malformed, not merely invalid)', malformed.status === 400, `got ${malformed.status}`);
const delTwice = await req('DELETE', `/patients/${id}`);
check('DELETE on already-deleted record returns 404', delTwice.status === 404, `got ${delTwice.status}`);
const putDeleted = await req('PUT', `/patients/${id}`, { city: 'X' });
check('PUT on deleted record returns 404', putDeleted.status === 404, `got ${putDeleted.status}`);
const health = await req('GET', '/');
check('GET / health endpoint responds 200', health.status === 200);

// ─────────────────────────────────────────────────────────────
section('§2 Data Model — required-field enforcement');

for (const field of ['first_name', 'last_name', 'date_of_birth', 'sex', 'phone_number', 'address_line_1', 'city', 'state', 'zip_code']) {
  const body = validPatient();
  delete body[field];
  const r = await req('POST', '/patients', body);
  check(`missing required "${field}" is rejected`, r.status === 422, `got ${r.status}`);
}
for (const field of ['email', 'address_line_2', 'insurance_provider', 'insurance_member_id', 'preferred_language', 'emergency_contact_name', 'emergency_contact_phone']) {
  const body = validPatient();
  const r = await req('POST', '/patients', body);
  if (r.status === 201) createdIds.push(r.body.data.patient_id);
  check(`optional "${field}" may be omitted`, r.status === 201, `got ${r.status}`);
}

// ─────────────────────────────────────────────────────────────
section('§2 Data Model — per-field validation rules');

const cases = [
  ['first_name 51 chars rejected', { first_name: 'A'.repeat(51) }, 422],
  ['first_name with digits rejected', { first_name: 'John3' }, 422],
  ['first_name with apostrophe accepted', { first_name: "O'Brien" }, 201],
  ['last_name with hyphen accepted', { last_name: 'Smith-Jones' }, 201],
  ['last_name with space rejected (spec: alphabetic + hyphen/apostrophe only)', { last_name: 'Van Der Berg' }, 422],
  ['future date_of_birth rejected', { date_of_birth: '2099-01-01' }, 422],
  ['non-date date_of_birth rejected', { date_of_birth: 'yesterday' }, 422],
  ['sex outside enum rejected', { sex: 'Unknown' }, 422],
  ['sex DeclineToAnswer accepted', { sex: 'DeclineToAnswer' }, 201],
  ['3-digit phone_number rejected', { phone_number: '555' }, 422],
  ['malformed email rejected', { email: 'not-an-email' }, 422],
  ['valid email accepted', { email: 'a.b@example.co' }, 201],
  ['non-state "XX" rejected', { state: 'XX' }, 422],
  ['4-digit zip rejected', { zip_code: '7870' }, 422],
  ['ZIP+4 accepted', { zip_code: '78701-1234' }, 201],
  ['alpha zip rejected', { zip_code: 'ABCDE' }, 422],
  ['emergency_contact_phone short rejected', { emergency_contact_phone: '123' }, 422],
  ['emergency_contact_name with spaces accepted', { emergency_contact_name: 'Mary Jane Watson' }, 201],
  ['insurance_member_id non-alphanumeric rejected', { insurance_member_id: 'BC-123!' }, 422],
];
for (const [name, over, expect] of cases) {
  const r = await req('POST', '/patients', validPatient(over));
  if (r.status === 201) createdIds.push(r.body.data.patient_id);
  check(name, r.status === expect, `got ${r.status} ${JSON.stringify(errMsgs(r))}`);
}

const multi = await req('POST', '/patients', validPatient({ state: 'ZZ', zip_code: 'abc', phone_number: '55', date_of_birth: '2099-01-01' }));
check('multiple bad fields reported together (agent can re-prompt precisely)', errMsgs(multi).length >= 4, `got ${errMsgs(multi).length} messages`);
check('  ...error names the specific field (state)', hasErrAbout(multi, 'state'));
check('  ...error names the specific field (zip_code)', hasErrAbout(multi, 'zip_code'));
check('  ...error names the specific field (phone_number)', hasErrAbout(multi, 'phone_number'));
check('  ...error names the specific field (date_of_birth)', hasErrAbout(multi, 'date_of_birth'));

const unknownField = await req('POST', '/patients', validPatient({ ssn: '123-45-6789' }));
check('unknown/unexpected field rejected (input sanitization)', unknownField.status === 422, `got ${unknownField.status}`);

// ─────────────────────────────────────────────────────────────
// Everything a caller can say correctly but in a shape the raw regexes would reject. Each failure
// here is a re-prompt for a question the caller already answered right, which is exactly the
// "handles corrections / sounds natural" axis the brief grades.
section('§2 Data Model — normalization of spoken & formatted input');

const norm = async (name, over, expectField, expectValue) => {
  const r = await req('POST', '/patients', validPatient(over));
  if (r.status === 201) createdIds.push(r.body.data.patient_id);
  check(name, r.status === 201 && r.body.data[expectField] === expectValue,
    `got ${r.status} ${expectField}=${JSON.stringify(r.body?.data?.[expectField]) ?? JSON.stringify(errMsgs(r))}`);
};

await norm('formatted phone "(512) 555-1234" normalized to digits', { phone_number: '(512) 555-1234' }, 'phone_number', '5125551234');
await norm('phone with country code "1-512-555-4321" drops the 1', { phone_number: '1-512-555-4321' }, 'phone_number', '5125554321');
await norm('lowercase state "tx" normalized to TX', { state: 'tx' }, 'state', 'TX');
await norm('spoken state name "Texas" normalized to TX', { state: 'Texas' }, 'state', 'TX');
await norm('two-word state "new york" normalized to NY', { state: 'new york' }, 'state', 'NY');
await norm('sex "Decline to Answer" (the brief\'s spelling) accepted', { sex: 'Decline to Answer' }, 'sex', 'DeclineToAnswer');
await norm('preferred_language defaults to English when omitted', {}, 'preferred_language', 'English');
await norm('blank optional email treated as not-provided, not invalid', { email: '' }, 'email', null);
await norm('blank optional emergency_contact_phone treated as not-provided', { emergency_contact_phone: '' }, 'emergency_contact_phone', null);

// The brief states MM/DD/YYYY. Parsed naively this lands a day early west of UTC, and the patient
// then cannot be found by the DOB filter — so assert the stored value and the round-trip.
const usDate = await req('POST', '/patients', validPatient({ date_of_birth: '03/09/1985' }));
if (usDate.status === 201) createdIds.push(usDate.body.data.patient_id);
check('MM/DD/YYYY date_of_birth stored as the date the caller said (no timezone shift)',
  usDate.body?.data?.date_of_birth?.startsWith('1985-03-09'), `got ${usDate.body?.data?.date_of_birth}`);
const usDateLookup = await req('GET', `/patients?date_of_birth=03/09/1985`);
check('  ...and is findable by ?date_of_birth= in MM/DD/YYYY',
  usDateLookup.body?.data?.some((p) => p.patient_id === usDate.body?.data?.patient_id));
const isoDateLookup = await req('GET', `/patients?date_of_birth=1985-03-09`);
check('  ...and by the same date written as YYYY-MM-DD',
  isoDateLookup.body?.data?.some((p) => p.patient_id === usDate.body?.data?.patient_id));

const feb30 = await req('POST', '/patients', validPatient({ date_of_birth: '02/30/1990' }));
check('impossible calendar date (Feb 30) rejected, not rolled forward to Mar 2', feb30.status === 422, `got ${feb30.status}`);
check('  ...and the message says the date is invalid, not "in the future"',
  errMsgs(feb30).some((m) => /valid date/i.test(m)) && !errMsgs(feb30).some((m) => /future/i.test(m)),
  JSON.stringify(errMsgs(feb30)));

const badFilter = await req('GET', '/patients?date_of_birth=whenever');
check('unparseable ?date_of_birth= is rejected, not silently ignored', badFilter.status === 422, `got ${badFilter.status}`);

// ─────────────────────────────────────────────────────────────
section('§4 Query filters');

const q1 = await req('GET', '/patients?last_name=Doe');
check('?last_name= filters', q1.status === 200 && q1.body.data.every((p) => p.last_name.toLowerCase() === 'doe'));
const q2 = await req('GET', '/patients?last_name=doe');
check('?last_name= is case-insensitive', q2.body?.data?.length === q1.body?.data?.length && q2.body.data.length > 0);
const q3 = await req('GET', '/patients?phone_number=5551234567');
check('?phone_number= filters (finds seeded Jane Doe)', q3.body?.data?.length === 1 && q3.body.data[0].first_name === 'Jane');
const q4 = await req('GET', '/patients?date_of_birth=1990-05-14');
check('?date_of_birth= filters', q4.body?.data?.length >= 1 && q4.body.data.every((p) => p.date_of_birth.startsWith('1990-05-14')));
const q5 = await req('GET', '/patients?last_name=Doe&phone_number=5551234567');
check('filters combine (AND)', q5.body?.data?.length === 1);
const q6 = await req('GET', '/patients?last_name=NoSuchName');
check('no matches returns empty array, not 404', q6.status === 200 && q6.body.data.length === 0);

// ─────────────────────────────────────────────────────────────
section('§5 Voice Agent ↔ Database integration');

const noSecret = await req('POST', '/voice/webhook', { message: { type: 'tool-calls', toolCallList: [] } });
check('webhook without secret is rejected 401', noSecret.status === 401, `got ${noSecret.status}`);
const wrongSecret = await req('POST', '/voice/webhook', { message: { type: 'tool-calls', toolCallList: [] } }, { 'x-vapi-secret': 'wrong' });
check('webhook with wrong secret is rejected 401', wrongSecret.status === 401, `got ${wrongSecret.status}`);

const vPhone = nextPhone();
const reg = await tool('register_patient', {
  first_name: 'Marcus', last_name: 'Lee', date_of_birth: '1988-07-01', sex: 'Male',
  phone_number: vPhone, address_line_1: '22 Pine St', city: 'Waco', state: 'TX', zip_code: '76701',
});
const regRes = toolResult(reg);
check('register_patient persists and returns success + patient_id', regRes.success === true && !!regRes.patient_id);
if (regRes.patient_id) createdIds.push(regRes.patient_id);
const viaRest = await req('GET', `/patients/${regRes.patient_id}`);
check('record written by VOICE is readable via REST (shared data layer)', viaRest.status === 200 && viaRest.body.data.first_name === 'Marcus');

const dup = await tool('check_existing_patient', { phone_number: vPhone });
const dupRes = toolResult(dup);
check('check_existing_patient finds returning caller by phone (BONUS: duplicate detection)',
  dupRes.found === true && dupRes.first_name === 'Marcus' && !!dupRes.patient_id);
const noDup = await tool('check_existing_patient', { phone_number: '9998887777' });
check('check_existing_patient returns found:false for a new caller', toolResult(noDup).found === false);

const upd = await tool('update_patient', { patient_id: regRes.patient_id, city: 'Austin' });
check('update_patient succeeds for returning caller', toolResult(upd).success === true);
const updCheck = await req('GET', `/patients/${regRes.patient_id}`);
check('  ...and the change is persisted', updCheck.body?.data?.city === 'Austin');

const badReg = await tool('register_patient', {
  first_name: 'Marcus', last_name: 'Lee', date_of_birth: '1988-07-01', sex: 'Male',
  phone_number: '555', address_line_1: '22 Pine St', city: 'Waco', state: 'TX', zip_code: '76701',
});
const badRegRes = toolResult(badReg);
check('register_patient with bad phone returns success:false (agent can re-prompt)', badRegRes.success === false);
check('  ...with a specific, speakable reason', /phone/i.test(badRegRes.message ?? ''), badRegRes.message);
check('  ...and does NOT return a 500 to Vapi', badReg.status === 201 || badReg.status === 200, `got ${badReg.status}`);

const futureReg = await tool('register_patient', { ...validPatient({ date_of_birth: '2099-03-03' }) });
check('register_patient with future DOB is refused server-side', toolResult(futureReg).success === false);
check('  ...naming date_of_birth specifically', /date_of_birth/.test(toolResult(futureReg).message ?? ''));

const multiCall = await req('POST', '/voice/webhook', {
  message: { type: 'tool-calls', toolCallList: [
    { id: 'a', type: 'function', function: { name: 'check_existing_patient', arguments: { phone_number: vPhone } } },
    { id: 'b', type: 'function', function: { name: 'check_existing_patient', arguments: { phone_number: '9998887777' } } },
  ] },
}, { 'x-vapi-secret': SECRET });
check('multiple tool calls in one payload are all answered', multiCall.body?.results?.length === 2);
check('  ...results are keyed back to their toolCallId', multiCall.body.results[0].toolCallId === 'a' && multiCall.body.results[1].toolCallId === 'b');

const unknownTool = await tool('drop_all_tables', {});
check('unknown tool name fails gracefully (no crash)', toolResult(unknownTool).success === false);
const noPatientId = await tool('update_patient', { city: 'Austin' });
check('update_patient without patient_id fails gracefully', toolResult(noPatientId).success === false);
const ghostUpdate = await tool('update_patient', { patient_id: '11111111-1111-1111-1111-111111111111', city: 'Austin' });
check('update_patient on non-existent record returns error, not silence (§5 DB-failure path)',
  toolResult(ghostUpdate).success === false && /not found/i.test(toolResult(ghostUpdate).message ?? ''));

const eoc = await req('POST', '/voice/webhook',
  { message: { type: 'end-of-call-report', summary: 'QA run', transcript: 'AI: hi. Caller: hi.' } },
  { 'x-vapi-secret': SECRET });
check('end-of-call-report accepted (transcript logging / observability)', eoc.status === 200 || eoc.status === 201);
const unknownEvent = await req('POST', '/voice/webhook', { message: { type: 'status-update', status: 'in-progress' } }, { 'x-vapi-secret': SECRET });
check('unrelated Vapi events are acknowledged, not errored (dropped-call resilience)', unknownEvent.status < 400, `got ${unknownEvent.status}`);
const emptyBody = await req('POST', '/voice/webhook', {}, { 'x-vapi-secret': SECRET });
check('malformed webhook body does not 500', emptyBody.status < 500, `got ${emptyBody.status}`);

// ─────────────────────────────────────────────────────────────
section('§3 Persistence — seed data');
const seeded = await req('GET', '/patients?last_name=Doe');
check('seed patient Jane Doe present', seeded.body?.data?.some((p) => p.first_name === 'Jane'));
const seeded2 = await req('GET', '/patients?last_name=Smith');
check('seed patient John Smith present', seeded2.body?.data?.some((p) => p.first_name === 'John'));

// ─────────────────────────────────────────────────────────────
// This suite runs against the real database, so it removes what it created. Without this the demo
// data a reviewer sees in GET /patients is buried under a hundred "Jane Tester" rows.
section('Cleanup');
let removed = 0;
for (const createdId of createdIds) {
  const r = await req('DELETE', `/patients/${createdId}`);
  if (r.status === 200 || r.status === 404) removed++;
}
check(`test records cleaned up (${removed}/${createdIds.length})`, removed === createdIds.length);
const leftovers = await req('GET', '/patients?last_name=Tester');
check('no test patients left behind', leftovers.body?.data?.length === 0, `${leftovers.body?.data?.length} left`);

console.log(`\n\x1b[1m${'─'.repeat(64)}\x1b[0m`);
console.log(`\x1b[1mRESULT\x1b[0m  \x1b[32m${pass} passed\x1b[0m, ${failures.length ? `\x1b[31m${failures.length} failed\x1b[0m` : '0 failed'}, ${notes.length} observation(s)`);
if (failures.length) {
  console.log('\n\x1b[31mFAILURES:\x1b[0m');
  failures.forEach((f) => console.log(`  • ${f.name}${f.detail ? ` — ${f.detail}` : ''}`));
}
process.exit(failures.length ? 1 : 0);
