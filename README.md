# Voice AI Patient Registration Agent

A voice agent that registers patients. You talk to it like you'd talk to a receptionist — it asks
for your name, date of birth, address and so on, reads everything back to check it got it right,
then saves you to a Postgres database. There's also a REST API to look the records up afterwards.

Built for the "Voice AI Agent — Patient Registration" take-home assessment.

**Stack:** [Vapi](https://vapi.ai) for the voice/LLM side, NestJS + TypeScript for the backend,
PostgreSQL with Prisma for storage.

---

## ⚠️ Read this first: it works, but there's no phone number

The agent is built, configured in Vapi, and **tested end to end** — I've had full conversations with
it through Vapi's "Talk to Assistant" browser call, registered patients by voice, and confirmed the
records landed in the database and came back out through the REST API.

What's missing is the **dialable phone number**. Provisioning a US number on Vapi or Twilio needs a
paid account with a card on file, and I wasn't able to make that purchase for this assessment. So
the system isn't reachable by dialing — but that's the only gap. A browser call and a phone call hit
exactly the same assistant, the same prompt, the same tools and the same database; the difference is
purely the carrier in front of it.

**To try it yourself:** Part 3 below walks through setting up the assistant in Vapi and talking to
it. It takes about ten minutes and doesn't need a card.

---

## Part 1 — Run the backend

### What you need

- Node.js 20 or newer
- A PostgreSQL database. Anything works. If you don't have one:

### 1. Install

```bash
npm install
```

This also generates the Prisma client, which the build needs.

### 2. Configure

```bash
cp .env.example .env
```

Then open `.env` and set three things:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Your Postgres connection string, e.g. `postgresql://postgres:postgres@localhost:5432/voice_ai_patient_agent?schema=public` |
| `PORT` | Port for the API. Defaults to `3000`. |
| `VAPI_SERVER_SECRET` | Any random string you make up. You'll paste the same value into Vapi later. It's how the backend knows a request really came from Vapi. |

For the secret, something like this is fine:

```bash
openssl rand -hex 24
```

### 3. Create the database tables

```bash
npx prisma migrate deploy
npm run db:seed
```

The seed adds two demo patients (Jane Doe and John Smith) so there's something to look at.

### 4. Start it

```bash
npm run start:dev
```

Wait for `Connected to Postgres` and `listening on port 3000`. **Leave this terminal open** — you'll
watch requests land here while you're talking to the agent, and it's by far the easiest way to tell
whether things are wired up correctly.

### 5. Check it works

In a second terminal:

```bash
curl http://localhost:3000/patients
```

You should get Jane Doe and John Smith back, wrapped like this:

```json
{ "data": [ ... ], "error": null }
```

If you see that, the backend is done. On to Vapi.

---

## Part 2 — Put the backend on the internet

Vapi runs in the cloud, so it can't reach `localhost`. Open a tunnel using ngrok or simply port forwarding:

```bash
ngrok http 3000
```

Copy the `https://` URL it gives. Check it:

```bash
curl https://YOUR-URL/patients
```

Same two patients = you're good.

---

## Part 3 — Set up the agent in Vapi

### 1. Create an account

Sign up at [vapi.ai](https://vapi.ai). New accounts come with free credit. You don't need a card for
the browser test call.

### 2. Create the assistant

**Assistants → Create Assistant → Blank.** Name it something like `Riverside Intake`.

### 3. Pick the LLM

In the assistant's **Model** section:

- **Model:** anything that supports tool calling. GPT-4o-mini is a good pick — cheap and fast, and
  latency matters a lot when someone's waiting on the line.
- **First Message:**
  ```
  Thanks for calling Riverside Family Clinic, this is Casey. How can I help you today?
  ```
- **System Prompt:** paste the prompt below.

<details>
<summary><b>Click to expand the system prompt</b>, with notes on why it's written this way)</summary>

```
You are Casey, a warm and efficient intake coordinator for Riverside Family Clinic, answering the
phone to register new patients. You are speaking, not typing — keep every turn short (1-3
sentences), never read out field names like "date_of_birth", and never use markdown or lists.

Collect information ONE FIELD AT A TIME, in this order:
1. First and last name
2. Date of birth
3. Sex (Male, Female, Other, or Decline to Answer)
4. Phone number (the best number to reach them)
5. Street address, city, state, and ZIP code
6. Email (optional — ask once, move on if declined)

As soon as you have a phone number, call check_existing_patient. If it returns found=true, say:
"It looks like we already have a record for {first_name} {last_name}. Would you like to update
your information instead, or is this a different person?" Follow the caller's answer — if they
confirm it's them, ask what changed and use update_patient with only the changed fields; if it's a
different person collect their own info under a different phone number.

VALIDATION — if an answer is invalid, do not move on. Explain briefly and re-ask that same field:
- Date of birth must be a real, past date. If a future or nonsense date is given, say "That date
  doesn't sound quite right — could you give me your date of birth again?"
- Phone number must be 10 digits. If too short/long, say "I need a 10-digit phone number, including
  area code — could you repeat that?"
- ZIP code must be 5 digits (or ZIP+4).
- State must be a real U.S. state. Send the full name or the abbreviation, whichever they said.

CORRECTIONS — if the caller corrects something ("actually, it's spelled D-A-V-I-S, not D-A-V-I-E-S"
or "no, my birthday is March, not May"), immediately update that field in your working notes and
confirm the corrected value back ("Got it — Davis, D-A-V-I-S."). Do not restart the conversation for
a correction.

STARTING OVER — if the caller says something like "let's start over" or "forget all that", confirm
("Sure, let's start fresh — first, what's your name?") and discard everything collected so far.

OPTIONAL FIELDS — once all required fields are collected, ask ONCE: "I can also collect your
insurance information, emergency contact, and preferred language, if you'd like. Want to add any of
that, or are we all set?" Only collect what they opt into. Don't ask about each one individually
unless they say "yes" generally, in which case go through insurance provider, insurance member ID,
emergency contact name, emergency contact phone, and preferred language, skipping any they don't
have.

CONFIRMATION — before saving, read back every field you collected in one natural sentence, e.g.:
"Let me make sure I have this right: Jane Doe, born May 14th, 1990, female, phone number
555-123-4567, at 123 Main Street, Austin, Texas, 78701. Did I get all of that correct?"
Only call register_patient (or update_patient) after the caller confirms. If they say something is
wrong, ask which field and fix just that one, then read the whole thing back again.

SAVING — call register_patient with the confirmed fields.
- If it returns success=true, say something like "You're all set, {first_name}! Thanks for calling,
  and take care." then end the call.
- If it returns success=false, apologize once, briefly explain the issue in plain language (not the
  raw error), fix that field with the caller, and try again. If it fails twice, say a staff member
  will follow up by phone and end the call gracefully — never leave the caller in silence.

LANGUAGE — if the caller says "Hablo español" or otherwise asks for Spanish, continue the entire
conversation in Spanish from that point on.

Stay natural and conversational throughout — you're a helpful human coordinator, not a form reader.
```

</details>

### 4. Pick the voice

- **Transcriber:** Deepgram, `nova-2`. It's noticeably better at names and addresses spoken out loud.
- **Voice:** any natural-sounding one. Avoid the robotic defaults — the brief specifically grades how
  human it sounds.

### 5. Create the three tools

**Tools → Create Tool → API Request** (it's under *Integrations*). Ignore the other tool types —
Transfer Call, Hang Up, Voicemail and so on are call-control actions, not what we need here.

Make three of them, pointing at the REST API. Swap in your ngrok subdomain:

| Tool name | Method | URL |
|---|---|---|
| `check_existing_patient` | GET | `https://YOUR-URL/patients?phone_number={{phone_number}}` |
| `register_patient` | POST | `https://YOUR-URL/patients` |
| `update_patient` | PUT | `https://YOUR-URL/patients/{{patient_id}}` |

Tool 1 takes one parameter, `phone_number`, in the query string. Tool 2 sends all the patient fields
as a JSON body. Tool 3 puts `patient_id` in the URL and the changed fields in the body.

<details>
<summary><b>Click to expand the tool parameters</b></summary>

**`check_existing_patient`** — one parameter:

| Parameter | Type | Notes |
|---|---|---|
| `phone_number` | string | required |

**`register_patient`** — required: `first_name`, `last_name`, `date_of_birth`, `sex`,
`phone_number`, `address_line_1`, `city`, `state`, `zip_code`.
Optional: `email`, `address_line_2`, `insurance_provider`, `insurance_member_id`,
`preferred_language`, `emergency_contact_name`, `emergency_contact_phone`.

Notes for the parameter descriptions:
- `date_of_birth` — MM/DD/YYYY or YYYY-MM-DD, both work
- `sex` — one of `Male`, `Female`, `Other`, `DeclineToAnswer`
- `state` — the 2-letter code or the full name, both work
- `phone_number` — punctuation and a leading `1` get stripped automatically

**`update_patient`** — same fields as above, all optional, plus a required `patient_id` (the UUID
that `check_existing_patient` returned).

The full JSON schemas are in [`docs/vapi-assistant-config.md`](docs/vapi-assistant-config.md) if you'd
rather copy-paste them.

</details>

**What the agent gets back:**

- Looking someone up: `{"data":[...]}` — a non-empty array means they're a returning caller, `[]`
  means they're new.
- Saving: `201` with the new `patient_id`.
- Bad data: `422`, with `error.message` listing exactly which fields were wrong — so the agent can
  re-ask for just that one thing instead of starting over.

### 6. Set the assistant's Server URL

Separate from the tools, the assistant itself has a **Server URL** for lifecycle events. Set it to:

```
https://YOUR-URL/voice/webhook
```

and set the **Server URL Secret** to your `VAPI_SERVER_SECRET` from `.env`.

This is what sends the call transcript to the backend at the end of a call, which gets logged.

### 7. Save.

---

## Part 4 — Talk to it

Open your assistant and hit **Talk to Assistant**. Allow microphone access. Casey should greet you.

Try something like:

> "Hi, I'd like to register as a new patient."
> — "Sarah Chen." … "March third, nineteen ninety-two." … "Female."
> — "Five one two, five five five, oh one nine eight."
> — "14 Oak Lane, Austin, Texas, seven eight seven zero four."


### Things worth trying

These are the behaviors the brief grades, so they're worth a look:

| Say this | What should happen |
|---|---|
| "My birthday is March 3rd, **2027**." | Asks again for the date only — doesn't restart |
| "My number is **555**." | Asks for a full 10-digit number |
| Mid-readback: "Actually it's **C-H-E-N**, not Chan." | Fixes that one field and re-confirms |
| "Can we **start over**?" | Resets and begins again |
| "**No thanks**" when offered extras | Saves with just the required fields |
| "**Hablo español**" | Switches to Spanish |

Also the UI to view patients will be at: `YOOR-URL/dashboard`
---

## The REST API

Every response is wrapped as `{ "data": ..., "error": ... }`.

| Method | Endpoint | What it does |
|---|---|---|
| GET | `/patients` | List everyone. Filter with `?last_name=`, `?date_of_birth=`, `?phone_number=` |
| GET | `/patients/:id` | One patient by UUID |
| POST | `/patients` | Create. Returns the new record with its `patient_id` |
| PUT | `/patients/:id` | Update. Send only the fields that changed |
| DELETE | `/patients/:id` | Soft delete — sets `deleted_at`, the row stays in the database |

Status codes: `200`/`201` when it works, `400` if the request itself is malformed, `422` if it parses
but a field is invalid, `404` if the record isn't there, `500` if something unexpected breaks.

Validation runs on the server regardless of what the agent already checked, so the API can't be
talked into storing junk.

**A note on messy input.** The same field arrives typed by a developer and transcribed from speech,
so the API tidies things up before validating: `(512) 555-1234` and `1-512-555-1234` both become
`5125551234`; `Texas`, `texas` and `tx` all become `TX`; `03/09/1985` and `1985-03-09` are the same
date. That's a deliberate voice decision — every needless rejection is the agent asking someone to
repeat something they already said correctly.

---

## Tests

```bash
npm test          # 59 unit tests — no server or database needed
npm run qa        # 110 end-to-end checks — server must be running
```

The unit tests cover the validation and normalization logic through exactly the calls the voice
agent makes, so the phone-call path is tested without any infrastructure. The end-to-end suite
drives a real server and database, including simulated Vapi webhook payloads, and cleans up after
itself.

---

## How it's put together

```
You talking  →  Vapi  →  ngrok  →  NestJS  →  Postgres
                (speech, LLM,       (validates,
                 the prompt)         saves)
                                          ↑
curl / Postman  ─────────────────────────┘
```

- `src/voice/` — the only code that knows Vapi exists. Receives tool calls, hands them to the
  patient service.
- `src/patient/` — the data layer: validation rules, database queries, REST endpoints.
- `src/prisma/` — one shared database connection.
- `src/common/` — the response envelope and error handling.

The voice agent and the REST API go through **the same service**, so there's exactly one code path
that writes a patient to the database. Nothing can be valid over the phone but invalid over HTTP.

**Why Vapi?** It bundles telephony, speech-to-text, text-to-speech and the LLM into one config. The
brief explicitly encourages this and says it isn't interested in you building a speech-to-text
engine, so the effort went into the prompt, the tool design and the backend instead.

**Why Postgres?** Native `uuid`, `date` and `enum` column types, so the data model's rules are
enforced by the database and not just by the application in front of it.

---

### Proof it works

Three moments from a live browser call with the assistant:

**1. Collecting details and reading them back for confirmation**

![The agent collecting patient details and confirming them](docs/demo/01-conversation.png)

**2. The agent calling the backend to save the record**

![register_patient tool call firing against the API](docs/demo/02-tool-call.png)

**3. The record, retrieved afterwards through the REST API**

![The saved patient returned by GET /patients](docs/demo/03-record-saved.png)

---

## Known limitations

- **No dialable phone number, and not deployed.** The agent has been tested by voice through Vapi's
  browser call, but you can't ring it, and the backend runs locally behind ngrok rather than on a
  host. Attaching a number needs a paid telephony account; no code changes are required once it is.
- **Names are ASCII only.** The brief says "alphabetic plus hyphens and apostrophes", so `Van Der
  Berg` and `Núñez` both get rejected. That follows the spec, but it's wrong for real patients and
  would be the first rule I'd revisit.
- **No authentication on the REST API.** The brief only asks for input sanitization, and the voice
  webhook is secret-protected, but `/patients` is open. Fine for a demo, not for anything public.
- **No request de-duplication.** If Vapi retried a tool call you'd get two records. Fine for one
  caller at a time; would need handling under real load.
- **Duplicate detection is advisory.** The agent offers to update an existing record, but nothing
  stops a second one being created if the caller insists or the lookup is skipped.
- **Call transcripts are logged to stdout only**, not saved against the patient record.
