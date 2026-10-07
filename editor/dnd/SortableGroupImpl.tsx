import { useEditMode } from '../../components/EditMode';
import type { SortableGroupProps } from '../../components/SortableGroup';
import { SortableList } from './SortableList';

/** Edit-mode body of SortableGroup: drag within the group, saved through the edit mode. */
export default function SortableGroupImpl({ collection, items, className, renderItem }: SortableGroupProps<{ id: string }>) {
  const { reorder } = useEditMode();
  return (
    <SortableList items={items} className={className} renderItem={renderItem} onReorder={(ids) => reorder(collection, ids)} />
  );
}
