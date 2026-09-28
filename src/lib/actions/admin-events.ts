'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { eventPeople, events } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';
import { isAppDate } from '@/lib/date';

export type ActionState = { error: string | null; ok?: string };

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || isAppDate(v), 'Not a valid date')
  .nullable();

const optionalTime = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || /^\d{2}:\d{2}(:\d{2})?$/.test(v), 'Not a valid time')
  .nullable();

const eventSchema = z
  .object({
    title: z.string().trim().min(1, 'Give the event a name').max(80),
    icon: z.string().trim().min(1, 'Pick an icon').max(16),
    repeats: z.enum(['once', 'weekly']),
    date: optionalDate,
    daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)),
    startsOn: optionalDate,
    endsOn: optionalDate,
    startTime: optionalTime,
    endTime: optionalTime,
    location: z.string().trim().max(80).transform((v) => (v === '' ? null : v)).nullable(),
    notes: z.string().trim().max(400).transform((v) => (v === '' ? null : v)).nullable(),
    isSchoolRelated: z.boolean(),
    personIds: z.array(z.coerce.number().int().positive()),
  })
  .superRefine((v, ctx) => {
    if (v.repeats === 'once' && !v.date) {
      ctx.addIssue({ code: 'custom', message: 'Pick a date', path: ['date'] });
    }
    if (v.repeats === 'weekly' && v.daysOfWeek.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Pick at least one day', path: ['daysOfWeek'] });
    }
    if (v.endsOn && v.startsOn && v.endsOn < v.startsOn) {
      ctx.addIssue({ code: 'custom', message: 'The end date is before the start date', path: ['endsOn'] });
    }
  });

function parse(form: FormData) {
  return eventSchema.safeParse({
    title: form.get('title') ?? '',
    icon: form.get('icon') ?? '',
    repeats: form.get('repeats') ?? 'once',
    date: form.get('date') ?? '',
    daysOfWeek: form.getAll('daysOfWeek').map(Number).filter(Number.isInteger),
    startsOn: form.get('startsOn') ?? '',
    endsOn: form.get('endsOn') ?? '',
    startTime: form.get('startTime') ?? '',
    endTime: form.get('endTime') ?? '',
    location: form.get('location') ?? '',
    notes: form.get('notes') ?? '',
    isSchoolRelated: form.get('isSchoolRelated') === 'on',
    personIds: form.getAll('personIds').map(Number).filter(Number.isInteger),
  });
}

/** Shapes the row so the database's "exactly one schedule mode" CHECK holds. */
function toRow(v: z.infer<typeof eventSchema>) {
  const weekly = v.repeats === 'weekly';
  return {
    title: v.title,
    icon: v.icon,
    date: weekly ? null : v.date,
    daysOfWeek: weekly ? v.daysOfWeek : null,
    startsOn: weekly ? v.startsOn : null,
    endsOn: weekly ? v.endsOn : null,
    startTime: v.startTime,
    endTime: v.endTime,
    location: v.location,
    notes: v.notes,
    isSchoolRelated: v.isSchoolRelated,
  };
}

export async function createEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/events');
  const parsed = parse(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const db = await getDb();
  const [row] = await db.insert(events).values(toRow(parsed.data)).returning();
  if (parsed.data.personIds.length > 0) {
    await db.insert(eventPeople).values(
      parsed.data.personIds.map((personId) => ({ eventId: row.id, personId })),
    );
  }

  revalidatePath('/admin/events');
  revalidatePath('/week');
  revalidatePath('/');
  return { error: null, ok: `Added "${parsed.data.title}"` };
}

export async function updateEvent(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/events');
  const id = z.coerce.number().int().positive().safeParse(form.get('id'));
  if (!id.success) return { error: 'That event could not be found.' };

  const parsed = parse(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const db = await getDb();
  await db.update(events).set(toRow(parsed.data)).where(eq(events.id, id.data));
  // Replace the people links wholesale; simpler than diffing and the sets are tiny.
  await db.delete(eventPeople).where(eq(eventPeople.eventId, id.data));
  if (parsed.data.personIds.length > 0) {
    await db.insert(eventPeople).values(
      parsed.data.personIds.map((personId) => ({ eventId: id.data, personId })),
    );
  }

  revalidatePath('/admin/events');
  revalidatePath('/week');
  revalidatePath('/');
  return { error: null, ok: 'Saved' };
}

export async function deleteEvent(id: number): Promise<void> {
  await requireParentPin('/admin/events');
  const db = await getDb();
  // event_people cascades. Events carry no history worth preserving.
  await db.delete(events).where(eq(events.id, id));
  revalidatePath('/admin/events');
  revalidatePath('/week');
  revalidatePath('/');
}
