# Smile Studio: AI Dental CRM

A premium CRM for dental clinics, built for AI automation:

- **Patients**: full profiles, medical alerts, tags, status pipeline (Lead → New → Active → Needs follow-up → Inactive) and a unified timeline of visits, treatments, AI calls, messages and notes.
- **Doctor availability**: weekly working hours with breaks, leave and time off, and the treatments each doctor performs. A slot engine computes free times from this and from existing bookings.
- **Calendar**: a day view per doctor with off-hours shading, and one-click confirm, complete, no-show or cancel.
- **AI voice receptionist API**: tools for finding or creating patients, checking availability, holding, booking, rescheduling, cancelling and escalating emergencies, plus a call-report webhook. See [docs/voice-agent.md](docs/voice-agent.md).
- **Automated follow-ups**: rules such as *"15 days after any treatment → WhatsApp check-in"*, *24h/2h appointment reminders*, *6-month cleaning recall*, *next-day check after extraction* and *no-show rebooking*. Rules have quiet hours, opt-out handling and dedupe, and send through Twilio SMS or WhatsApp (simulated when Twilio isn't configured).
- **Dashboard**: today's schedule, AI-booked count, new patients, no-shows, revenue, tasks and recent calls. Light and dark themes, responsive down to phone width.

## Stack

Next.js 14 (App Router, server actions) · TypeScript · Tailwind CSS · PostgreSQL · Prisma · Zod · Vitest

## Getting started

```bash
cp .env.example .env          # set DATABASE_URL, clinic details and secrets
npm install
npm run db:push               # create tables
npm run db:seed               # demo doctors, patients, appointments and rules
npm run dev                   # http://localhost:3000
```

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

- Staff login with roles (admin, doctor, receptionist) and an audit log. **The app has no authentication yet, so don't expose it publicly.**
- AI-personalised message wording and two-way replies (YES confirms, RESCHEDULE triggers a rebook)
- Drag-and-drop rescheduling and a week view
- Waitlist auto-fill on cancellations, no-show risk scores, review requests, reactivation campaigns
- Outbound AI confirmation calls, reports and multi-clinic support
