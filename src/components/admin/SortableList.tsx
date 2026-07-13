import { ReactNode } from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props to spread onto the element that should initiate a drag.
 *
 * These must land on the grip only. Spreading them on the whole row makes every
 * button and input inside the row swallow its own clicks to start a drag instead.
 */
export type DragHandleProps = Record<string, unknown>;

interface SortableListProps<T> {
  items: T[];
  getId: (item: T) => string;
  /** Receives the full list of ids in their new order. */
  onReorder: (orderedIds: string[]) => void;
  children: (item: T, index: number, handleProps: DragHandleProps) => ReactNode;
  className?: string;
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  children,
  className,
}: SortableListProps<T>) {
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a plain click still clicks.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = items.map(getId);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;

    onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableRow key={getId(item)} id={getId(item)}>
              {(handleProps) => children(item, index, handleProps)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handleProps: DragHandleProps) => ReactNode;
}) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 opacity-80')}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

/** The grip users actually grab. Spread the handle props from SortableList onto it. */
export function DragHandle({
  handleProps,
  label,
  className,
}: {
  handleProps: DragHandleProps;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex-shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground',
        'hover:bg-muted hover:text-foreground focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing',
        className
      )}
      {...handleProps}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

export default SortableList;
