import React from 'react';
import { talks } from '../data';
import { MapPin, User, Calendar } from 'lucide-react';

const Talks: React.FC = () => {
  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-light text-gray-900 mb-2">invited talks</h1>
      </div>

      <div className="grid gap-6">
        {talks.map((talk) => (
          <div key={talk.id} className="bg-white border-l-4 border-purple-500 shadow-sm hover:shadow-md transition-shadow p-6 rounded-r-lg">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{talk.title}</h3>
            {talk.event && (
                <div className="text-purple-600 font-medium text-sm mb-3 uppercase tracking-wide">
                    {talk.event}
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>{talk.date}</span>
                </div>
                <div className="flex items-center gap-2">
                    <MapPin size={16} />
                    <span>{talk.location}</span>
                </div>
                <div className="flex items-center gap-2">
                    <User size={16} />
                    <span>Host: {talk.host}</span>
                </div>
                {talk.collaborators && (
                     <div className="flex items-center gap-2 col-span-1 md:col-span-2 text-gray-500 italic">
                        <span>With: {talk.collaborators}</span>
                    </div>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Talks;