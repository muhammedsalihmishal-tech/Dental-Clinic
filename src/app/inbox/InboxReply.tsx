"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Send } from "lucide-react";
import { replyToInbound } from "@/app/actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary btn-sm gap-1.5" disabled={pending}>
      <Send className="h-3.5 w-3.5" />
      {pending ? "Sending…" : "Send"}
    </button>
  );
}

export function InboxReply({ id, phone, channel }: { id: string; phone: string; channel: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(replyToInbound, undefined);

  if (state?.ok) {
    return <span className="text-xs text-emerald-600 font-medium">Replied ✓</span>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost btn-sm gap-1.5">
        <Send className="h-3.5 w-3.5" /> Reply
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="channel" value={channel} />
      <textarea
        name="body"
        rows={3}
        autoFocus
        placeholder="Type your reply…"
        className="input w-full text-sm"
        required
      />
      {state?.error && <p className="text-xs text-rose-600">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitBtn />
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
