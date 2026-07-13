import { supabase } from '@/integrations/supabase/client';

export type ReorderableEntity = 'learning_paths' | 'capsules' | 'capsule_content';

export function reorderArray<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...arr];
  if (fromIndex < 0 || fromIndex >= copy.length) return copy;
  if (toIndex < 0) toIndex = 0;
  if (toIndex >= copy.length) toIndex = copy.length - 1;
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

/**
 * Writes `order_index` for every id, in array order, as a single statement.
 *
 * Falls back to parallel per-row updates when the `reorder_entities` migration
 * has not been applied to the target database yet.
 */
export async function persistOrder(
  entity: ReorderableEntity,
  orderedIds: string[]
): Promise<void> {
  const { error } = await supabase.rpc('reorder_entities', {
    p_entity: entity,
    p_ids: orderedIds,
  });

  if (!error) return;

  // PGRST202 = function not found in the schema cache (migration not applied yet).
  const missingRpc = error.code === 'PGRST202';
  if (!missingRpc) throw error;

  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from(entity).update({ order_index: index }).eq('id', id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export default reorderArray;
