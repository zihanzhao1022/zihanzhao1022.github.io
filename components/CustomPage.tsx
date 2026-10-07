import React from 'react';
import { renderMarkdown } from '../lib/markdown';
import { NavItem } from '../types';
import { EditButton, HiddenBadge } from './EditMode';

/** A page the owner created in the navigation settings: a title and a Markdown body. */
const CustomPage: React.FC<{ item: Extract<NavItem, { type: 'page' }> }> = ({ item }) => (
  <div className="animate-fade-in pb-20">
    <div className="mb-10">
      <h1 className="text-3xl font-light text-gray-900 mb-2">
        {item.title}
        <EditButton
          request={{ kind: 'edit', collection: 'navigation', id: item.id }}
          label="编辑页面"
          className="ml-3 align-middle"
        />
        {item.hidden && <HiddenBadge />}
      </h1>
    </div>
    {/* The body text is light, where the browser's "bolder" would barely show, so bold gets an explicit weight. */}
    <div className="[&_strong]:font-semibold" dangerouslySetInnerHTML={{ __html: renderMarkdown(item.body ?? '') }} />
  </div>
);

export default CustomPage;
