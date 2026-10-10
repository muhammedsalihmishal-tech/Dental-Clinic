# Smile Studio: AI Dental CRM

A premium CRM for dental clinics, built for AI automation:

- **Patients**: full profiles, medical alerts, tags, status pipeline (Lead → New → Active → Needs follow-up → Inactive) and a unified timeline of visits, treatments, AI calls, messages and notes.
- **Doctor availability**: weekly working hours with breaks, leave and time off, and the treatments each doctor performs. A slot engine computes free times from this and from existing bookings.
- **Calendar**: a day view per doctor with off-hours shading, and one-click confirm, complete, no-show or cancel.
- **AI voice receptionist API**: tools for finding or creating patients, checking availability, holding, booking, rescheduling, cancelling and escalating emergencies, plus a call-report webhook. See [docs/voice-agent.md](docs/voice-agent.md).
- **Automated follow-ups**: rules such as *"15 days after any treatment → WhatsApp check-in"*, *24h/2h appointment reminders*, *6-month cleaning recall*, *next-day check after extraction* and *no-show rebooking*. Rules have quiet hours, opt-out handling and dedupe, and send through Twilio SMS or WhatsApp (simulated when Twilio isn't configured).
- **Dashboard**: today's schedule, AI-booked count, new patients, no-shows, revenue, tasks and recent calls. Light and dark themes, responsive down to phone width.
- **Auth**: staff login (email + password) with roles — Admin, Doctor, Receptionist. Admin-only user management and audit log.
- **Reports**: monthly revenue chart, revenue by treatment, doctor utilization, AI call outcomes, booking sources and patient pipeline, all computed from live data.
- **Waitlist**: queue patients for a treatment/doctor; one click notifies them via their preferred channel when a slot opens.
- **No-show risk**: heuristic score (0–100, Low/Medium/High) per patient based on past no-show rate, recent missed appointments and gap since last visit — visible on the patient profile and patients list.

## Stack

Next.js 14 (App Router, server actions) · TypeScript · Tailwind CSS · PostgreSQL · Prisma · Zod · Vitest

## Getting started

```bash
cp .env.example .env          # set DATABASE_URL, NEXTAUTH_SECRET, clinic details and secrets
npm install
npm run db:push               # create tables
npm run db:seed               # demo doctors, patients, appointments and rules
npm run dev                   # http://localhost:3000
```

Login with the seeded admin account: **admin@smilestudio.com / admin1234** — change the password immediately.
Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`.

### Sending reminders

Call the cron endpoint every 5 minutes from any scheduler (Vercel Cron, GitHub Actions, crontab):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/reminders
```

You can also press **Send due messages now** on the Follow-ups page.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Unit tests (slot engine, reminder timing, time zones) |
| `npm run typecheck` / `npm run lint` | Static checks |

## Project layout

```
prisma/schema.prisma        data model
src/lib/availability.ts     slot engine (working hours − time off − bookings)
src/lib/booking.ts          book / hold / reschedule / cancel with per-doctor locking
src/lib/reminders.ts        follow-up rule engine and sender
src/lib/voice-tools.ts      tools exposed to the voice agent
src/app/api/...             voice tools, voice webhook, availability, reminder cron
src/app/...                 dashboard, calendar, patients, doctors, follow-ups, calls
```

## Roadmap

- AI-personalised message wording (Claude-generated, per-patient context) and two-way replies (YES confirms, RESCHEDULE triggers a rebook)
- Drag-and-drop rescheduling and a week calendar view
- Auto-fill waitlist on cancellations (send notification automatically when a matching slot opens)
- Google review requests after successful visits, reactivation campaigns for 12-month-inactive patients
- Outbound AI confirmation calls and multi-clinic support
