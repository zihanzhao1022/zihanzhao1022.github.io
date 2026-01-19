import React from 'react';

interface ListItemProps {
  image?: string;
  title: string;
  subtitle: React.ReactNode;
  meta: React.ReactNode;
  links?: Record<string, string>;
  tags?: React.ReactNode;
  sideContent?: React.ReactNode; // e.g. Year displayed on the side
}

const ListItem: React.FC<ListItemProps> = ({
  image,
  title,
  subtitle,
  meta,
  links,
  tags,
  sideContent
}) => {
  return (
    <div className="group relative flex flex-col sm:flex-row gap-6 p-4 mb-6 hover:bg-gray-50 rounded-lg transition-colors duration-300">
      {/* Side Content (e.g. Year) - Visible on larger screens primarily */}
      {sideContent && (
        <div className="absolute top-4 right-4 text-3xl font-bold text-gray-100 select-none pointer-events-none group-hover:text-gray-200 transition-colors">
          {sideContent}
        </div>
      )}

      {/* Image Thumbnail */}
      <div className="flex-shrink-0 w-full sm:w-48 h-32 border border-gray-200 bg-white rounded-md overflow-hidden flex items-center justify-center relative z-10">
        {image ? (
          <img src={image} alt="thumbnail" className="w-full h-full object-contain p-2" />
        ) : (
          <div className="w-full h-full bg-transparent flex items-center justify-center text-gray-300 text-xs uppercase tracking-wider">
            No Image
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-grow z-10 relative">
        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-2">
          {title}
        </h3>
        
        <div className="text-gray-700 text-sm mb-2 font-light">
          {subtitle}
        </div>

        <div className="text-sm italic text-gray-500 mb-2">
          {meta}
        </div>

        {/* Combined Tags and Actions Row */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
           {/* Tags (Rank/Level) - Placed First */}
           {tags && (
             <div className="flex-shrink-0 mr-1">
               {tags}
             </div>
           )}

           {/* Action Buttons */}
           {links && Object.entries(links).map(([key, url]) => (
            url && (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="px-2 py-1 border border-gray-900 text-gray-900 text-[10px] uppercase font-bold tracking-wider hover:bg-gray-900 hover:text-white transition-colors rounded-sm"
              >
                {key}
              </a>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export default ListItem;