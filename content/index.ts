import { Award, Experience, NavItem, NewsItem, Profile, Project, Publication, SiteContent, Talk } from '../types';
import awards from './awards.json';
import experiences from './experiences.json';
import navigation from './navigation.json';
import news from './news.json';
import profile from './profile.json';
import projects from './projects.json';
import publications from './publications.json';
import talks from './talks.json';

// Content bundled at build time. The edit mode replaces it with the latest version from GitHub.
export const bundledContent: SiteContent = {
  profile: profile as Profile,
  news: news as NewsItem[],
  experiences: experiences as Experience[],
  publications: publications as Publication[],
  projects: projects as Project[],
  talks: talks as Talk[],
  awards: awards as Award[],
  // JSON infers plain strings for the entry types, so this union needs the cast through unknown.
  navigation: navigation as unknown as NavItem[],
};
