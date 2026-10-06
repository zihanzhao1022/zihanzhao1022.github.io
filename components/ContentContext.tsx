import { createContext, useContext } from 'react';
import { bundledContent } from '../content';
import { SiteContent } from '../types';

// Visitors see the bundled content. The edit mode provides fresher content through this context.
export const ContentContext = createContext<SiteContent>(bundledContent);

export const useContent = (): SiteContent => useContext(ContentContext);
