import { Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, Empty, Field, PageHeader } from "@/components/ui";
import { saveTreatmentType, deleteTreatmentType } from "../../actions";

export const dynamic = "force-dynamic";

export default async function TreatmentsPage() {
  const treatments = await prisma.treatmentType.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        title="Treatment types"
        subtitle="Manage durations, pricing, colours and Google review links."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {treatments.length === 0 && <Empty>No treatment types yet.</Empty>}
          {treatments.map((t) => (
            <div key={t.id} className="card fade-in p-5">
              <form action={saveTreatmentType} className="space-y-3">
                <input type="hidden" name="id" value={t.id} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Name" className="col-span-2">
                    <input name="name" defaultValue={t.name} required className="input" />
                  </Field>
                  <Field label="Duration (min)">
                    <input name="durationMinutes" type="number" min={5} defaultValue={t.durationMinutes} className="input" />
                  </Field>
                  <Field label="Buffer (min)">
                    <input name="bufferMinutes" type="number" min={0} defaultValue={t.bufferMinutes} className="input" />
                  </Field>
                  <Field label="Price (₹)">
                    <input name="price" type="number" min={0} defaultValue={t.price} className="input" />
                  </Field>
                  <Field label="Colour">
                    <div className="flex items-center gap-2">
                      <input name="color" type="color" defaultValue={t.color} className="h-9 w-12 cursor-pointer rounded border border-border bg-surface p-1" />
                      <span className="text-xs text-muted">{t.color}</span>
                    </div>
                  </Field>
                  <Field label="Google review link" className="col-span-2">
                    <input name="reviewLink" type="url" placeholder="https://g.page/r/..." defaultValue={t.reviewLink ?? ""} className="input" />
                  </Field>
                </div>
                <div className="flex justify-end gap-2">
                  <form action={deleteTreatmentType}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="btn-ghost btn-sm text-rose-500" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </form>
                  <button type="submit" className="btn-primary btn-sm">Save</button>
                </div>
              </form>
            </div>
          ))}
        </div>

        <Card title="New treatment type">
          <form action={saveTreatmentType} className="space-y-3 p-5">
            <Field label="Name"><input name="name" required placeholder="e.g. Root Canal" className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration (min)"><input name="durationMinutes" type="number" min={5} defaultValue={30} className="input" /></Field>
              <Field label="Buffer (min)"><input name="bufferMinutes" type="number" min={0} defaultValue={0} className="input" /></Field>
            </div>
            <Field label="Price (₹)"><input name="price" type="number" min={0} defaultValue={0} className="input" /></Field>
            <Field label="Colour">
              <input name="color" type="color" defaultValue="#6366f1" className="h-9 w-full cursor-pointer rounded border border-border bg-surface p-1" />
            </Field>
            <Field label="Google review link">
              <input name="reviewLink" type="url" placeholder="https://g.page/r/..." className="input" />
            </Field>
            <button className="btn-primary w-full">Create</button>
          </form>
        </Card>
      </div>
    </>
  );
}
