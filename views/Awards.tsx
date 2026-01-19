import React, { useState, useMemo } from 'react';
import { awardsList } from '../data';
import { AwardType } from '../types';
import ListItem from '../components/ListItem';

const AWARD_TYPES: { type: AwardType | 'all', label: string }[] = [
  { type: 'all', label: 'All' },
  { type: 'international', label: 'International' },
  { type: 'national', label: 'National (China)' },
  { type: 'provincial', label: 'Provincial (China)' },
  { type: 'scholarship', label: 'Scholarship' },
];

const getBadgeStyle = (level: string) => {
  const text = level.toLowerCase();

  // Gold / 1st / Winner / Master
  if (
    text.includes('gold') ||
    text.includes('first') ||
    text.includes('1st') ||
    text.includes('grand') ||
    text.includes('master') ||
    text.includes('winner')
  ) {
    return 'bg-yellow-500 text-white border-yellow-500';
  }

  // Silver / 2nd
  if (
    text.includes('silver') ||
    text.includes('second') ||
    text.includes('2nd')
  ) {
    return 'bg-slate-400 text-white border-slate-400';
  }

  // Bronze / 3rd
  if (
    text.includes('bronze') ||
    text.includes('third') ||
    text.includes('3rd')
  ) {
    return 'bg-amber-700 text-white border-amber-700';
  }

  // Default
  return 'bg-orange-400 text-white border-orange-400';
};

const Awards: React.FC = () => {
  const [filter, setFilter] = useState('');
  const [selectedType, setSelectedType] = useState<AwardType | 'all'>('all');

  const sortedAwards = useMemo(() => {
    // 1. Filter
    const filtered = awardsList.filter(item => {
      // Text Search
      const matchesSearch = item.title.toLowerCase().includes(filter.toLowerCase()) ||
        item.issuer.toLowerCase().includes(filter.toLowerCase());

      if (!matchesSearch) return false;

      // Type Filter
      if (selectedType !== 'all' && item.type !== selectedType) return false;

      return true;
    });

    // 2. Sort by Year Descending
    return filtered.sort((a, b) => b.year - a.year);
  }, [filter, selectedType]);

  const uniqueYears = useMemo(() => {
    return Array.from(new Set(sortedAwards.map(a => a.year))).sort((a, b) => b - a);
  }, [sortedAwards]);

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-light text-gray-900 mb-2">honors & awards</h1>
        <p className="text-sm text-gray-500">
          competitions, scholarships, and recognitions.
        </p>
      </div>

      {/* Controls Container */}
      <div className="mb-10 space-y-4">
        {/* Search Bar */}
        <input
          type="text"
          placeholder="Filter awards..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-purple-500 text-sm"
        />

        {/* Type Tabs */}
        <div className="flex flex-wrap items-center gap-2">
            {AWARD_TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => setSelectedType(t.type)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
                  selectedType === t.type
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </div>

      <div className="space-y-2">
        {uniqueYears.map((year) => (
          <div key={year}>
            {/* Year Separator */}
            <div className="flex items-center pt-6 pb-4">
               <span className="text-3xl font-light text-gray-300 mr-4 select-none">{year}</span>
               <div className="h-px bg-gray-100 flex-grow"></div>
            </div>

            <div className="space-y-4">
              {sortedAwards
                .filter((a) => a.year === year)
                .map((award) => (
                  <ListItem
                    key={award.id}
                    title={award.title}
                    image={award.image}
                    subtitle={
                      <span className="text-gray-700 font-medium">
                        {award.issuer}
                      </span>
                    }
                    meta={
                      <div className="text-sm text-gray-500 italic">
                        {award.date}
                      </div>
                    }
                    tags={
                      <div className="flex gap-2">
                        {/* Type Tag (mimicking publication layout but simpler) */}
                        <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded text-gray-600 bg-gray-100 border border-gray-200 uppercase tracking-wider">
                           {award.type === 'national' ? 'National' :
                            award.type === 'provincial' ? 'Provincial' :
                            award.type}
                        </span>

                        {/* Level Tag (Dynamic Color) */}
                        {award.level && (
                          <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded border ${getBadgeStyle(award.level)}`}>
                             {award.level}
                          </span>
                        )}

                        {/* Prize Tag */}
                        {award.prize && (
                           <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded text-white bg-emerald-600">
                             {award.prize}
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

      {sortedAwards.length === 0 && (
        <div className="text-center text-gray-500 py-12 italic">
          No awards found matching criteria.
        </div>
      )}
    </div>
  );
};

export default Awards;