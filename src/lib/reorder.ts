export function reorderArray<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...arr];
  if (fromIndex < 0 || fromIndex >= copy.length) return copy;
  if (toIndex < 0) toIndex = 0;
  if (toIndex >= copy.length) toIndex = copy.length - 1;
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

export default reorderArray;
