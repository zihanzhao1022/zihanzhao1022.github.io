import React from 'react';
import { Crosshair, Plus, Shield } from 'lucide-react';
import { N_ } from '../lib/i18n';
import { resolveImage } from '../lib/localImages';
import { useT } from '../lib/phrases/site';
import { OverwatchRank } from '../types';

// The names the game uses in each language.
const ROLES = {
  tank: { label: N_('重装'), Icon: Shield },
  damage: { label: N_('输出'), Icon: Crosshair },
  support: { label: N_('支援'), Icon: Plus },
} as const;

const TIERS: Record<string, string> = {
  Bronze: N_('青铜'),
  Silver: N_('白银'),
  Gold: N_('黄金'),
  Platinum: N_('白金'),
  Diamond: N_('钻石'),
  Master: N_('大师'),
  Grandmaster: N_('宗师'),
  Champion: N_('英杰'),
};

// The game's emblem of each tier, cut out of its background.
const EMBLEMS: Record<string, string> = {
  Grandmaster: '/images/overwatch/grandmaster.png',
};

/** A tier's emblem with the division in a badge below it, as the game shows them. */
const Emblem: React.FC<{ tier: string; division: number }> = ({ tier, division }) => (
  <div className="relative flex h-20 w-28 items-start justify-center">
    {EMBLEMS[tier] && <img src={resolveImage(EMBLEMS[tier])} alt="" className="h-16 w-auto drop-shadow-sm" />}
    <span className="absolute bottom-0 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-violet-300 bg-indigo-950 text-xs font-bold text-white">
      {division}
    </span>
  </div>
);

/** The competitive rank of each role, shown under the bio when the Overwatch icon is clicked. */
const OverwatchRanks: React.FC<{ ranks: OverwatchRank[] }> = ({ ranks }) => {
  const t = useT();
  return (
    <div
      aria-label={t('守望先锋竞技段位')}
      className="grid grid-cols-3 gap-3 rounded-lg border border-purple-100 bg-gradient-to-b from-purple-50/70 to-white p-4 font-normal animate-fade-in"
    >
      {ranks.map((rank) => {
        const { label, Icon } = ROLES[rank.role];
        return (
          <div key={rank.role} className="flex flex-col items-center text-center">
            <Emblem tier={rank.tier} division={rank.division} />
            <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <Icon className="h-3.5 w-3.5" />
              {t(label)}
            </div>
            <div className="text-sm font-medium text-gray-900">
              {TIERS[rank.tier] ? t(TIERS[rank.tier]) : rank.tier} {rank.division}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OverwatchRanks;
