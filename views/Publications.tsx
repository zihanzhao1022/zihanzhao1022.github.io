import React, { useState, useMemo } from 'react';
import { useLocalizedContent } from '../components/ContentContext';
import { AddButton, useVisibleItems } from '../components/EditMode';
import { SortableGroup } from '../components/SortableGroup';
import { N_ } from '../lib/i18n';
import { useT } from '../lib/phrases/site';
import { PublicationType, Rank } from '../types';
import ListItem from '../components/ListItem';

const ALL_RANKS: Rank[] = ['Q1', 'Q2', 'Q3', 'Q4', 'CORE-A*', 'CORE-A', 'CORE-B', 'CORE-C', 'Unranked'];

// Filter buttons and section titles, translated where shown.
const TYPES: { type: 'all' | PublicationType; label: string }[] = [
  { type: 'all', label: N_('全部') },
  { type: 'journal', label: N_('期刊') },
  { type: 'conference', label: N_('会议') },
];
const SECTION_TITLES: Record<PublicationType, string> = { journal: N_('期刊论文'), conference: N_('会议论文') };

// Helper Component for Authors
const AuthorList: React.FC<{ authors: string[] }> = ({ authors }) => {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const THRESHOLD = 5; // Number of authors to show before collapsing

  const formatName = (name: string) => {
    const isMe = name.includes("**");
    const cleanName = name.replace(/\*\*/g, "");
    if (isMe) {
      // Bold and Underline for the user
      return <strong className="font-bold underline decoration-2 underline-offset-2">{cleanName}</strong>;
    }
    return cleanName;
  };

  // If few authors or expanded, show all
  if (authors.length <= THRESHOLD || expanded) {
    return (
      <span>
        {authors.map((author, idx) => (
          <React.Fragment key={idx}>
            {formatName(author)}
            {idx < authors.length - 1 ? ", " : ""}
          </React.Fragment>
        ))}
        {authors.length > THRESHOLD && (
          <button 
             onClick={(e) => { e.preventDefault(); setExpanded(false); }}
             className="ml-2 text-xs text-purple-600 hover:text-purple-800 hover:underline cursor-pointer select-none font-medium"
          >
            {t('（收起）')}
          </button>
        )}
      </span>
    );
  }

  // Collapsed View
  const visible = authors.slice(0, THRESHOLD);
  return (
    <span>
       {visible.map((author, idx) => (
          <React.Fragment key={idx}>
            {formatName(author)}
            {", "}
          </React.Fragment>
       ))}
       <button 
           onClick={(e) => { e.preventDefault(); setExpanded(true); }}
           className="text-purple-600 hover:text-purple-800 hover:underline cursor-pointer select-none font-medium"
       >
          {t('…（还有 {n} 位）', { n: authors.length - THRESHOLD })}
       </button>
    </span>
  );
};

const Publications: React.FC = () => {
  const publications = useVisibleItems(useLocalizedContent().publications);
  const t = useT();
  const [filter, setFilter] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | PublicationType>('all');
  const [selectedRanks, setSelectedRanks] = useState<Rank[]>([]);

  const toggleRank = (rank: Rank) => {
    if (selectedRanks.includes(rank)) {
      setSelectedRanks(selectedRanks.filter(r => r !== rank));
    } else {
      setSelectedRanks([...selectedRanks, rank]);
    }
  };

  // Filter, then sort by year (newest first); within a year the stored order applies (set by dragging).
  const sortedPublications = useMemo(() => {
    // 1. Filter
    const filtered = publications.filter(pub => {
      // Text Search
      const matchesSearch = pub.title.toLowerCase().includes(filter.toLowerCase()) || 
        pub.authors.some(a => a.toLowerCase().includes(filter.toLowerCase())) ||
        pub.venue.toLowerCase().includes(filter.toLowerCase());
      
      if (!matchesSearch) return false;

      // Type Filter
      if (selectedType !== 'all' && pub.type !== selectedType) return false;

      // Rank Filter
      if (selectedRanks.length > 0 && !selectedRanks.includes(pub.rank)) return false;

      return true;
    });

    // 2. Sort (stable, so items of the same year keep their stored order)
    return filtered.sort((a, b) => b.year - a.year);
  }, [publications, filter, selectedType, selectedRanks]);

  const displayedTypes: PublicationType[] = selectedType === 'all' ? ['journal', 'conference'] : [selectedType];

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-light text-gray-900 mb-2">
          {t('论文')}
          <AddButton request={{ kind: 'add', collection: 'publications' }} text={t('添加论文')} className="ml-3" />
        </h1>
        <p className="text-sm text-gray-500">
          {t('按类别分组，按时间倒序排列。')}
        </p>
      </div>

      {/* Controls Container */}
      <div className="mb-10 space-y-4">
        {/* Search Bar */}
        <input 
          type="text" 
          placeholder={t('输入关键词筛选…')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-purple-500 text-sm"
        />

        {/* Filters */}
        <div className="flex flex-col gap-3">
          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">{t('类型：')}</span>
            {TYPES.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                  selectedType === type
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {t(label)}
              </button>
            ))}
          </div>

          {/* Rank Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">{t('等级：')}</span>
            {ALL_RANKS.map((rank) => (
              <button
                key={rank}
                onClick={() => toggleRank(rank)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                  selectedRanks.includes(rank)
                    ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {rank === 'Unranked' ? t('其他') : rank}
              </button>
            ))}
            {selectedRanks.length > 0 && (
              <button
                onClick={() => setSelectedRanks([])}
                className="ml-2 text-xs text-red-500 hover:text-red-700 underline"
              >
                {t('清除')}
              </button>
            )}
          </div>
        </div>
      </div>

      {displayedTypes.map((type) => {
        const typePubs = sortedPublications.filter(p => p.type === type);
        
        if (typePubs.length === 0) return null;

        // Group pubs by year for this type
        const uniqueYears = Array.from(new Set(typePubs.map(p => p.year))).sort((a: number, b: number) => b - a);

        return (
          <div key={type} className="mb-12">
            <h2 className="text-xl font-bold uppercase tracking-wider text-purple-700 mb-6 border-b-2 border-purple-100 pb-2 inline-block">
              {t(SECTION_TITLES[type])}
            </h2>
            
            <div className="space-y-2">
              {uniqueYears.map((year) => (
                <div key={year}>
                  {/* Year Separator */}
                  <div className="flex items-center pt-6 pb-4">
                     <span className="text-3xl font-light text-gray-300 mr-4 select-none">{year}</span>
                     <div className="h-px bg-gray-100 flex-grow"></div>
                  </div>

                  {/* Publications for this year */}
                  <SortableGroup
                    collection="publications"
                    items={typePubs.filter((p) => p.year === year)}
                    className="space-y-4"
                    renderItem={(pub) => (
                        <ListItem
                          key={pub.id}
                          editRequest={{ kind: 'edit', collection: 'publications', id: pub.id }}
                          hidden={pub.hidden}
                          title={pub.title}
                          image={pub.image}
                          subtitle={<AuthorList authors={pub.authors} />}
                          meta={
                            <span>
                              <em className="font-serif">{pub.venue}</em>
                            </span>
                          }
                          links={pub.links}
                          tags={
                            <div className="flex gap-2">
                              {/* Rank Tag */}
                              <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded text-white ${
                                pub.rank === 'Unranked' ? 'bg-gray-400' :
                                pub.rank.startsWith('Q1') || pub.rank.includes('A*') ? 'bg-red-500' : 
                                pub.rank.startsWith('Q2') || pub.rank.includes('A') ? 'bg-orange-400' : 'bg-blue-400'
                              }`}>
                                {pub.rank === 'Unranked' ? t('其他') : pub.rank}
                              </span>

                              {/* Impact Factor Tag (Only for Journals) */}
                              {pub.type === 'journal' && pub.impactFactor && (
                                <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded text-white bg-teal-700">
                                  IF: {pub.impactFactor}
                                </span>
                              )}
                            </div>
                          }
                        />
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      
      {sortedPublications.length === 0 && (
        <div className="text-center text-gray-500 py-12 italic">
          {t('没有符合筛选条件的论文。')}
        </div>
      )}
    </div>
  );
};

export default Publications;