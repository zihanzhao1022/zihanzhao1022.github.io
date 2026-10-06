import React, { createContext, useContext, useState } from 'react';
import { bundledContent } from '../content';
import { SiteContent } from '../types';

// Visitors see the bundled content. The edit mode provides fresher content through this context.
export const ContentContext = createContext<SiteContent>(bundledContent);

const ContentUpdateContext = createContext<React.Dispatch<React.SetStateAction<SiteContent>>>(() => {});

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [content, setContent] = useState(bundledContent);
  return (
    <ContentUpdateContext.Provider value={setContent}>
      <ContentContext.Provider value={content}>{children}</ContentContext.Provider>
    </ContentUpdateContext.Provider>
  );
};

export const useContent = (): SiteContent => useContext(ContentContext);

/** Lets the edit mode replace the content after loading or saving. */
export const useUpdateContent = (): React.Dispatch<React.SetStateAction<SiteContent>> => useContext(ContentUpdateContext);
