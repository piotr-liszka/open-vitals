/**
 * Reordering (spec 064). Pure, so a drag-and-drop layer only has to decide *from* and *to* — the
 * list surgery is testable without synthesising a single drag event, and keyboard move buttons and
 * mouse drag provably do the same thing because they call the same function.
 */

/**
 * `items` with the element at `from` moved to index `to`, as a new array.
 *
 * Out-of-range indices return the original array rather than throwing: `to` comes from a drop target
 * and `from` from a drag source, and neither is worth crashing a render over. A no-op move returns
 * the original reference too, which lets a caller skip a pointless save.
 */
export function moveItem<T>(items: readonly T[], from: number, to: number): readonly T[] {
  if (from === to) return items;
  if (from < 0 || from >= items.length) return items;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}
