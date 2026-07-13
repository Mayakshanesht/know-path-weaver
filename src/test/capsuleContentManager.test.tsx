import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { CapsuleContent } from '@/types/database';

const rpc = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock('@/components/ui/tiptap-editor', () => ({
  TiptapEditor: () => null,
}));

import CapsuleContentManager from '@/components/admin/CapsuleContentManager';
import { persistOrder } from '@/lib/reorder';

const makeItem = (id: string, title: string, order: number): CapsuleContent =>
  ({
    id,
    capsule_id: 'cap-1',
    content_type: 'youtube',
    title,
    content_value: `https://youtube.com/watch?v=${id}`,
    description: null,
    order_index: order,
  }) as CapsuleContent;

const renderManager = (content: CapsuleContent[]) =>
  render(
    <CapsuleContentManager
      capsuleId="cap-1"
      content={content}
      onRefresh={() => {}}
      open
      onOpenChange={() => {}}
    />
  );

describe('CapsuleContentManager', () => {
  beforeEach(() => {
    sessionStorage.clear();
    rpc.mockClear();
    cleanup();
  });

  it('renders the content list without a hook-order crash when items are present', () => {
    renderManager([makeItem('a', 'Intro video', 0), makeItem('b', 'Slides', 1)]);

    expect(screen.getByText('Intro video')).toBeInTheDocument();
    expect(screen.getByText('Slides')).toBeInTheDocument();
  });

  it('survives the empty -> populated transition that used to throw React error #310', () => {
    // The drag-and-drop hooks used to be called inside an IIFE that only ran when
    // content was non-empty, so the hook count changed between these two renders.
    const { rerender } = renderManager([]);
    expect(screen.getByText('No content added yet.')).toBeInTheDocument();

    expect(() =>
      rerender(
        <CapsuleContentManager
          capsuleId="cap-1"
          content={[makeItem('a', 'Intro video', 0)]}
          onRefresh={() => {}}
          open
          onOpenChange={() => {}}
        />
      )
    ).not.toThrow();

    expect(screen.getByText('Intro video')).toBeInTheDocument();
  });

  it('exposes a real drag handle per row rather than making the whole row draggable', () => {
    renderManager([makeItem('a', 'Intro video', 0), makeItem('b', 'Slides', 1)]);

    // A grip the user can grab, and buttons that stay clickable next to it.
    expect(screen.getByLabelText('Reorder Intro video')).toBeInTheDocument();
    expect(screen.getByLabelText('Reorder Slides')).toBeInTheDocument();
  });
});

describe('persistOrder', () => {
  beforeEach(() => rpc.mockClear());

  it('saves the whole new order in one atomic call', async () => {
    await persistOrder('capsule_content', ['c', 'a', 'b']);

    expect(rpc).toHaveBeenCalledWith('reorder_entities', {
      p_entity: 'capsule_content',
      p_ids: ['c', 'a', 'b'],
    });
  });

  it('falls back to per-row updates when the migration is not applied yet', async () => {
    rpc.mockResolvedValueOnce({ error: { code: 'PGRST202', message: 'not found' } });

    await expect(persistOrder('capsules', ['b', 'a'])).resolves.toBeUndefined();
  });

  it('surfaces real errors instead of silently swallowing them', async () => {
    rpc.mockResolvedValueOnce({ error: { code: '42501', message: 'permission denied' } });

    await expect(persistOrder('capsules', ['b', 'a'])).rejects.toMatchObject({
      message: 'permission denied',
    });
  });
});
