import React from 'react';
import { experiences } from '../data';
import { ExperienceCategory } from '../types';
import ListItem from '../components/ListItem';

const SECTIONS: { id: ExperienceCategory; title: string }[] = [
  { id: 'education', title: 'Education' },
  { id: 'work', title: 'Work Experience' },
  { id: 'volunteer', title: 'Volunteer & Service' },
];

const Experiences: React.FC = () => {
  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-light text-gray-900 mb-2">experiences</h1>
        <p className="text-sm text-gray-500">
          My academic journey, professional roles, and volunteer experiences in universities.
        </p>
      </div>

      <div className="space-y-16">
        {SECTIONS.map((section) => {
          const items = experiences.filter((e) => e.category === section.id);
          
          if (items.length === 0) return null;

          return (
            <div key={section.id}>
              {/* Section Header */}
              <h2 className="text-xl font-bold uppercase tracking-wider text-purple-700 mb-8 border-b-2 border-purple-100 pb-2 inline-block">
                {section.title}
              </h2>

              <div className="space-y-4">
                {items.map((exp) => (
                  <ListItem
                    key={exp.id}
                    title={exp.title}
                    image={exp.image}
                    subtitle={
                      <span className="text-gray-900 font-semibold">
                        {exp.institution}
                      </span>
                    }
                    meta={
                      <div className="flex flex-col gap-1 text-sm text-gray-600 mt-1">
                         {/* Common Meta: Location & Date */}
                         <div className="italic text-gray-500">
                           {exp.date}  •  {exp.location}
                         </div>

                         {/* Education Specifics */}
                         {section.id === 'education' && exp.department && (
                            <div className="text-gray-700">{exp.department}</div>
                         )}

                         {/* Work/Volunteer Description */}
                         {section.id !== 'education' && exp.description && (
                            <div className="mt-2 text-gray-600 leading-relaxed font-light">
                              {exp.description}
                            </div>
                         )}
                      </div>
                    }
                    tags={
                      section.id === 'education' && (exp.gpa || exp.rank) ? (
                        <div className="flex gap-2 mt-1">
                          {exp.gpa && (
                             <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded text-white bg-indigo-500">
                               GPA: {exp.gpa}
                             </span>
                          )}
                          {exp.rank && (
                             <span className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded text-white bg-purple-500">
                               Rank: {exp.rank}
                             </span>
                          )}
                        </div>
                      ) : null
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Experiences;