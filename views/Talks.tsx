import React from 'react';
import { useLocalizedContent } from '../components/ContentContext';
import { AddButton, EditButton, HiddenBadge, useVisibleItems } from '../components/EditMode';
import { SortableGroup } from '../components/SortableGroup';
import { MapPin, User, Calendar } from 'lucide-react';
import { localDate } from '../lib/dates';
import { useLang } from '../lib/i18n';
import { useT } from '../lib/phrases/site';

const Talks: React.FC = () => {
  const talks = useVisibleItems(useLocalizedContent().talks);
  const t = useT();
  const lang = useLang();
  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-light text-gray-900 mb-2">
          {t('受邀报告')}
          <AddButton request={{ kind: 'add', collection: 'talks' }} text={t('添加报告')} className="ml-3" />
        </h1>
      </div>

      <SortableGroup
        collection="talks"
        items={talks}
        className="grid gap-6"
        renderItem={(talk) => (
          <div key={talk.id} className={`bg-white border-l-4 border-purple-500 shadow-sm hover:shadow-md transition-shadow p-6 rounded-r-lg${talk.hidden ? ' opacity-50' : ''}`}>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              <EditButton
                request={{ kind: 'edit', collection: 'talks', id: talk.id }}
                label={t('编辑这场报告')}
                className="float-right ml-3"
              />
              {talk.title}
              {talk.hidden && <HiddenBadge />}
            </h3>
            {talk.event && (
                <div className="text-purple-600 font-medium text-sm mb-3 uppercase tracking-wide">
                    {talk.event}
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>{localDate(talk.date, lang)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    <span>{talk.location}</span>
                </div>
                <div className="flex items-center gap-2">
                    <User size={16} />
                    <span>{t('主办：{host}', { host: talk.host })}</span>
                </div>
                {talk.collaborators && (
                     <div className="flex items-center gap-2 col-span-1 md:col-span-2 text-gray-500 italic">
                        <span>{t('合作：{collaborators}', { collaborators: talk.collaborators })}</span>
                    </div>
                )}
            </div>
          </div>
        )}
      />
    </div>
  );
};

export default Talks;