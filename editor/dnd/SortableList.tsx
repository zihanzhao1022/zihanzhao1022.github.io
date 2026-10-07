import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

export interface SortableListProps<T extends { id: string }> {
  items: T[];
  /** Class of the list container. */
  className: string;
  renderItem: (item: T) => React.ReactNode;
  onReorder: (ids: string[]) => void;
  /** Positions the grip; by default it sits in the page margin left of the item. */
  handleClassName?: string;
}

// Fits the page margin: main has px-6 (24px) on phones and md:px-12 (48px) from 768px up.
const MARGIN_HANDLE = 'absolute top-1/2 -translate-y-1/2 -left-6 md:-left-9';

function SortableRow({ id, handleClassName, children }: { id: string; handleClassName: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // While dragging, the row stays as a dashed placeholder of the same size (an outline does not move the layout).
      className={`relative${isDragging ? ' rounded-lg outline-dashed outline-2 outline-purple-300 bg-purple-50/40' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        title="拖动排序"
        {...attributes}
        {...listeners}
        aria-label="拖动排序"
        className={`${handleClassName} z-20 p-0.5 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 cursor-grab active:cursor-grabbing touch-none`}
      >
        <GripVertical size={18} />
      </button>
      <div className={isDragging ? 'invisible' : undefined}>{children}</div>
    </div>
  );
}

/** A vertical list reordered by dragging a grip; the dragged item floats above the page while it moves. */
export function SortableList<T extends { id: string }>({
  items,
  className,
  renderItem,
  onReorder,
  handleClassName = MARGIN_HANDLE,
}: SortableListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((item) => item.id);
  const active = activeId === null ? undefined : items.find((item) => item.id === activeId);

  const onDragStart = ({ active: dragged }: DragStartEvent) => setActiveId(String(dragged.id));
  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || dragged.id === over.id) return;
    onReorder(arrayMove(ids, ids.indexOf(String(dragged.id)), ids.indexOf(String(over.id))));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id} handleClassName={handleClassName}>
              {renderItem(item)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {active ? (
          <div className="rounded-lg bg-white shadow-2xl ring-1 ring-purple-200 scale-[1.02] -rotate-1 cursor-grabbing">
            {renderItem(active)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
