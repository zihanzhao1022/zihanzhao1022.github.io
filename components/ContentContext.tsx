import React, { createContext, useContext, useMemo, useState } from 'react';
import { bundledContent } from '../content';
import { useLang } from '../lib/i18n';
import { localize } from '../lib/localize';
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

/** The content as stored, in English with the owner's translations alongside; edits start from it. */
export const useContent = (): SiteContent => useContext(ContentContext);

/** The content in the site's language, for showing: the owner's Chinese or Japanese versions where they wrote them. */
export const useLocalizedContent = (): SiteContent => {
  const content = useContent();
  const lang = useLang();
  return useMemo(() => localize(content, lang), [content, lang]);
};

/** Lets the edit mode replace the content after loading or saving. */
export const useUpdateContent = (): React.Dispatch<React.SetStateAction<SiteContent>> => useContext(ContentUpdateContext);
