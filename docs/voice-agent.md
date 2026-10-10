# Connecting the AI voice receptionist

The CRM exposes everything a voice agent needs to answer calls and book appointments from live doctor availability. These steps use [Vapi](https://vapi.ai). Retell and other providers work the same way through the plain `{ "tool", "arguments" }` format.

## 1. Endpoints

| Purpose | Method and path | Auth |
| --- | --- | --- |
| Tool calls during the conversation | `POST /api/voice/tools` | `x-voice-secret: $VOICE_TOOL_SECRET` |
| Tool definitions (JSON schema) to paste into the assistant | `GET /api/voice/tools` | same |
| End-of-call report (summary, transcript, recording) | `POST /api/voice/webhook` | same |

In Vapi, set the assistant's **Server URL** to `https://<your-domain>/api/voice/webhook` and add a custom header `x-voice-secret`. Create each tool from `GET /api/voice/tools`, with its server URL set to `https://<your-domain>/api/voice/tools`.

## 2. Tools

| Tool | What it does |
| --- | --- |
| `get_clinic_info` | Address, opening hours, treatments, prices |
| `find_patient` | Look up by caller ID or name; returns the next appointment, last treatment and medical alerts |
| `create_patient` | Register a new caller (deduplicated by phone) |
| `check_availability` | Free times for a treatment, optionally filtered by date (`today`/`tomorrow`/`YYYY-MM-DD`), doctor and `morning`/`afternoon`/`evening`; spread out so the agent can offer 2–3 options |
| `hold_slot` | Reserve a time for 5 minutes while confirming details |
| `book_appointment` | Confirm a hold, or book directly (any free qualified doctor if none named) |
| `get_upcoming_appointments` | Used before rescheduling or cancelling |
| `reschedule_appointment` / `cancel_appointment` | Move or cancel; reminders are re-queued automatically |
| `transfer_to_human` | Creates a staff task (URGENT for emergencies) and returns the clinic number to forward to |

Bookings are serialised per doctor with a Postgres advisory lock, so two callers can never get the same slot.

## 3. Suggested system prompt

```text
You are Maya, the receptionist at {{clinic name}}. You sound like a warm, calm, real person:
short sentences, natural fillers ("sure", "let me just check that for you"), never robotic lists.

On every call:
1. Greet, then call find_patient with the caller's number. If found, greet them by first name
   and mention their upcoming appointment if relevant.
2. Understand why they're calling. If they describe severe pain, swelling, bleeding, a knocked-out
   tooth or trauma, reassure them and call transfer_to_human with emergency=true.
3. To book: ask what it's for, then call check_availability. Offer at most two or three times
   ("I have 10 tomorrow morning with Dr. Aisha, or 2:30 in the afternoon. Which suits you?").
   Once they choose, hold_slot, confirm name and time back to them, then book_appointment.
4. New callers: get first name, last name and confirm their number, then create_patient.
5. Before cancelling, always offer to reschedule.
6. Never give medical diagnoses. Never invent prices or times; only use tool results.
7. If a tool returns an error, apologise briefly and offer another option or a transfer.
8. Reply in the caller's language (English, Malayalam, Hindi, Arabic, Tamil).
End by confirming the date, time, doctor and address, and say they'll get a WhatsApp reminder.
```

Add a structured-data field `outcome` (one of `booked, rescheduled, cancelled, enquiry, transferred, emergency, missed, other`) to the assistant's analysis plan so the CRM can label each call.

## 4. Testing locally

```bash
curl -X POST localhost:3000/api/voice/tools \
  -H 'content-type: application/json' -H 'x-voice-secret: change-me' \
  -d '{"tool":"check_availability","arguments":{"treatment":"cleaning","timeOfDay":"morning"}}'
```
