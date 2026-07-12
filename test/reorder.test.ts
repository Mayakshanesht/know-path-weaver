import { describe, it, expect } from 'vitest';
import { reorderArray } from '@/lib/reorder';

describe('reorderArray', () => {
  it('moves item forward', () => {
    const arr = [1, 2, 3, 4];
    const res = reorderArray(arr, 1, 3);
    expect(res).toEqual([1, 3, 4, 2]);
  });

  it('moves item backward', () => {
    const arr = ['a', 'b', 'c'];
    const res = reorderArray(arr, 2, 0);
    expect(res).toEqual(['c', 'a', 'b']);
  });

  it('handles out-of-bounds gracefully', () => {
    const arr = [1, 2, 3];
    expect(reorderArray(arr, -1, 2)).toEqual([1, 2, 3]);
    expect(reorderArray(arr, 5, 0)).toEqual([1, 2, 3]);
  });
});
