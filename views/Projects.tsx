import React, { useMemo } from 'react';
import { useContent } from '../components/ContentContext';
import { AddButton, useVisibleItems } from '../components/EditMode';
import { SortableGroup } from '../components/SortableGroup';
import ListItem from '../components/ListItem';

const Projects: React.FC = () => {
  const projects = useVisibleItems(useContent().projects);
  // Helper to extract the start year from a string like "2023 - Present"
  const getStartYear = (yearStr: string): number => {
    const match = yearStr.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => getStartYear(b.year) - getStartYear(a.year));
  }, [projects]);

  const uniqueYears = useMemo(() => {
    return Array.from(new Set(sortedProjects.map(p => getStartYear(p.year)))).sort((a, b) => b - a);
  }, [sortedProjects]);

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-10">
        <h1 className="text-3xl font-light text-gray-900 mb-2">
          projects
          <AddButton request={{ kind: 'add', collection: 'projects' }} text="添加项目" className="ml-3" />
        </h1>
        <p className="text-sm text-gray-500">research and development projects.</p>
      </div>

      <div className="space-y-2">
        {uniqueYears.map((year) => (
          <div key={year}>
            {/* Year Separator */}
            <div className="flex items-center pt-6 pb-4">
               <span className="text-3xl font-light text-gray-300 mr-4 select-none">{year}</span>
               <div className="h-px bg-gray-100 flex-grow"></div>
            </div>

            <SortableGroup
              collection="projects"
              items={sortedProjects.filter((p) => getStartYear(p.year) === year)}
              className="space-y-4"
              renderItem={(proj) => (
                <ListItem
                  key={proj.id}
                  editRequest={{ kind: 'edit', collection: 'projects', id: proj.id }}
                  hidden={proj.hidden}
                  title={proj.title}
                  image={proj.image}
                  subtitle={
                      <span className="text-gray-600 font-medium">{proj.role}</span>
                  }
                  meta={
                      <span className="block mt-2 text-gray-500 font-light">
                          {proj.description}
                      </span>
                  }
                  tags={
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">
                      {proj.level}
                    </span>
                  }
                />
              )}
            />
          </div>
        ))}
      </div>
      
      {sortedProjects.length === 0 && (
          <div className="text-center text-gray-500 py-12 italic">
            No projects found.
          </div>
      )}
    </div>
  );
};

export default Projects;