'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { people } from '@/db/schema';
import { requireParentPin } from '@/lib/guards';

export type ActionState = { error: string | null; ok?: string };

const personSchema = z.object({
  id: z.coerce.number().int().positive(),
  displayName: z.string().trim().min(1, 'Give them a name').max(30),
  colour: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Pick a colour'),
  icon: z.string().trim().min(1, 'Pick an icon').max(16),
});

/**
 * Update how a person looks. Deliberately does NOT touch `name`, which is the
 * identity used in URLs and in the seed script; `display_name` is what shows on
 * the wall and is the one worth editing.
 *
 * Contrast and colour-vision separation are checked in the UI rather than
 * blocked here: it is the family's call, and a hard rule would stop a parent
 * fixing something at 7am. The warnings are loud instead.
 */
export async function updatePerson(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireParentPin('/admin/people');

  const parsed = personSchema.safeParse({
    id: form.get('id'),
    displayName: form.get('displayName'),
    colour: form.get('colour'),
    icon: form.get('icon'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form' };

  const { id, displayName, colour, icon } = parsed.data;
  // Only a child's form carries the lunch setting; a parent's leaves it alone.
  const lunchToggle = form.get('hasLunchOnCard')
    ? { showLunchOnCard: form.get('showLunchOnCard') === 'on' }
    : {};
  const db = await getDb();
  await db
    .update(people)
    .set({ displayName, colour: colour.toUpperCase(), icon, ...lunchToggle })
    .where(eq(people.id, id));

  // The colour is referenced on every screen.
  revalidatePath('/', 'layout');
  return { error: null, ok: `Saved ${displayName}` };
}

export async function setPersonActive(id: number, isActive: boolean): Promise<void> {
  await requireParentPin('/admin/people');
  const db = await getDb();
  await db.update(people).set({ isActive }).where(eq(people.id, id));
  revalidatePath('/', 'layout');
}

export async function movePerson(id: number, direction: 'up' | 'down'): Promise<void> {
  await requireParentPin('/admin/people');
  const db = await getDb();
  const all = await db.select().from(people);
  const children = all.filter((p) => p.role === 'child').sort((a, b) => a.sortOrder - b.sortOrder);

  const i = children.findIndex((c) => c.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= children.length) return;

  await db.update(people).set({ sortOrder: children[j].sortOrder }).where(eq(people.id, children[i].id));
  await db.update(people).set({ sortOrder: children[i].sortOrder }).where(eq(people.id, children[j].id));
  revalidatePath('/', 'layout');
}
