import React, { useState, useMemo } from 'react';
import { publications } from '../data';
import { Rank } from '../types';
import ListItem from '../components/ListItem';

// Define Rank Priority
const RANK_PRIORITY: Record<Rank, number> = {
  'Q1': 10,
  'Q2': 9,
  'Q3': 8,
  'Q4': 7,
  'CORE-A*': 10,
  'CORE-A': 9,
  'CORE-B': 8,
  'CORE-C': 7,
  'Unranked': 0
};

const ALL_RANKS: Rank[] = ['Q1', 'Q2', 'Q3', 'Q4', 'CORE-A*', 'CORE-A', 'CORE-B', 'CORE-C', 'Unranked'];

// Helper Component for Authors
const AuthorList: React.FC<{ authors: string[] }> = ({ authors }) => {
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
            (show less)
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
          ... ({authors.length - THRESHOLD} more)
       </button>
    </span>
  );
};

const Publications: React.FC = () => {
  const [filter, setFilter] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'journal' | 'conference'>('all');
  const [selectedRanks, setSelectedRanks] = useState<Rank[]>([]);

  const toggleRank = (rank: Rank) => {
    if (selectedRanks.includes(rank)) {
      setSelectedRanks(selectedRanks.filter(r => r !== rank));
    } else {
      setSelectedRanks([...selectedRanks, rank]);
    }
  };

  // Sorting Logic: Year (Desc) -> Type -> Rank (Desc)
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

    // 2. Sort
    return filtered.sort((a, b) => {
      // Primary: Year Descending
      if (b.year !== a.year) return b.year - a.year;

      // Secondary: Rank Score
      const rankScoreA = RANK_PRIORITY[a.rank] || 0;
      const rankScoreB = RANK_PRIORITY[b.rank] || 0;
      return rankScoreB - rankScoreA; // Higher rank first
    });
  }, [filter, selectedType, selectedRanks]);

  const displayedTypes = selectedType === 'all' ? ['journal', 'conference'] : [selectedType];

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-light text-gray-900 mb-2">publications</h1>
        <p className="text-sm text-gray-500">
          publications by categories in reversed chronological order.
        </p>
      </div>

      {/* Controls Container */}
      <div className="mb-10 space-y-4">
        {/* Search Bar */}
        <input 
          type="text" 
          placeholder="Type to filter..." 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-purple-500 text-sm"
        />

        {/* Filters */}
        <div className="flex flex-col gap-3">
          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Type:</span>
            {['all', 'journal', 'conference'].map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type as any)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                  selectedType === type
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Rank Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-2">Rank:</span>
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
                {rank === 'Unranked' ? 'Else' : rank}
              </button>
            ))}
            {selectedRanks.length > 0 && (
              <button
                onClick={() => setSelectedRanks([])}
                className="ml-2 text-xs text-red-500 hover:text-red-700 underline"
              >
                Clear
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
              {type}s
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
                  <div className="space-y-4">
                    {typePubs
                      .filter((p) => p.year === year)
                      .map((pub) => (
                        <ListItem
                          key={pub.id}
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
                                {pub.rank === 'Unranked' ? 'Else' : pub.rank}
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
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      
      {sortedPublications.length === 0 && (
        <div className="text-center text-gray-500 py-12 italic">
          No publications match the selected filters.
        </div>
      )}
    </div>
  );
};

export default Publications;