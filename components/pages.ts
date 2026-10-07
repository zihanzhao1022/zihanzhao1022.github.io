import React from 'react';
import { BuiltinPage, NavItem } from '../types';
import About from '../views/About';
import Awards from '../views/Awards';
import CV from '../views/CV';
import Experiences from '../views/Experiences';
import Projects from '../views/Projects';
import Publications from '../views/Publications';
import Talks from '../views/Talks';

export const BUILTIN_ROUTES: Record<BuiltinPage, { path: string; component: React.ComponentType }> = {
  about: { path: '/', component: About },
  experiences: { path: '/experiences', component: Experiences },
  publications: { path: '/publications', component: Publications },
  projects: { path: '/projects', component: Projects },
  talks: { path: '/talks', component: Talks },
  awards: { path: '/awards', component: Awards },
  cv: { path: '/cv', component: CV },
};

/** Where a navigation entry points: a route inside the site, or the URL of an external link. */
export function pathOf(item: NavItem): string {
  if (item.type === 'builtin') return BUILTIN_ROUTES[item.page].path;
  if (item.type === 'page') return `/p/${item.slug}`;
  return item.url;
}
