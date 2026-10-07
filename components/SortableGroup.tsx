import React, { Suspense, lazy } from 'react';
import { ListCollection } from '../types';
import { useEditMode } from './EditMode';

export interface SortableGroupProps<T extends { id: string }> {
  collection: ListCollection;
  items: T[];
  /** Class of the list container: the same element visitors get, so their page never changes. */
  className: string;
  renderItem: (item: T) => React.ReactNode;
}

// The drag-and-drop library only loads in edit mode.
const SortableGroupImpl = lazy(() => import('../editor/dnd/SortableGroupImpl'));

/** A list that can be reordered by dragging while editing, and a plain list otherwise. */
export function SortableGroup<T extends { id: string }>({ collection, items, className, renderItem }: SortableGroupProps<T>) {
  const { editing } = useEditMode();
  const plain = (
    <div className={className}>
      {items.map((item) => (
        <React.Fragment key={item.id}>{renderItem(item)}</React.Fragment>
      ))}
    </div>
  );
  if (!editing) return plain;
  return (
    <Suspense fallback={plain}>
      <SortableGroupImpl
        collection={collection}
        items={items}
        className={className}
        renderItem={renderItem as (item: { id: string }) => React.ReactNode}
      />
    </Suspense>
  );
}
