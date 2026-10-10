import React from 'react';
import { Reader, avatarUrl } from '../presence';
import { OutlineItem } from './outlineItems';

interface Props {
  items: OutlineItem[];
  /** The item of the place being read. */
  active: string | null;
  /** Others on the page, by the item of where they are. */
  readers: Record<string, Reader[]>;
  onGo: (blockId: string) => void;
}

/** The page's headings with its figures and tables under them, like a table of contents. */
const Outline: React.FC<Props> = ({ items, active, readers, onGo }) => (
  <nav aria-label="目录" className="text-sm">
    <p className="mb-2 px-2 text-xs font-medium text-gray-400">目录</p>
    <ul className="space-y-0.5">
      {items.map((item) => {
        const here = item.blockId === active;
        const tone = here ? 'bg-purple-50 text-purple-700' : item.kind === 'heading' || item.kind === 'references' ? 'text-gray-700' : 'text-gray-500';
        return (
          <li key={item.blockId}>
            <button
              type="button"
              onClick={() => onGo(item.blockId)}
              aria-current={here ? 'location' : undefined}
              title={item.text}
              style={{ paddingLeft: `${0.5 + item.depth * 0.875}rem` }}
              className={`flex w-full items-center gap-2 rounded-md py-1 pr-2 text-left hover:bg-gray-50 ${tone} ${item.kind === 'figure' || item.kind === 'table' ? 'text-xs' : ''}`}
            >
              <span className="min-w-0 flex-1 truncate">{item.text}</span>
              {(readers[item.blockId] ?? []).slice(0, 3).map((reader) => (
                <img
                  key={reader.login}
                  src={avatarUrl(reader.id, 40)}
                  alt={reader.login}
                  title={`@${reader.login} 正在看这里`}
                  className="h-4 w-4 shrink-0 rounded-full bg-gray-200 ring-1 ring-white"
                />
              ))}
            </button>
          </li>
        );
      })}
    </ul>
  </nav>
);

export default Outline;
