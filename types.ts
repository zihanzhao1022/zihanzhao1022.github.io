export type PublicationType = 'journal' | 'conference';
export type Rank = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'CORE-A*' | 'CORE-A' | 'CORE-B' | 'CORE-C' | 'Unranked';
export type AwardType = 'international' | 'national' | 'provincial' | 'scholarship';
export type ExperienceCategory = 'education' | 'work' | 'volunteer';

export interface SocialLink {
  platform: 'email' | 'github' | 'linkedin' | 'orcid' | 'wechat';
  url: string;
  label?: string;
  qrCode?: string; // Optional: URL to QR code image (e.g. for WeChat)
}

/** List items can be hidden: kept in the data, left out for visitors. */
interface Hideable {
  hidden?: boolean;
}

export interface NewsItem extends Hideable {
  id: string;
  date: string;
  content: string;
}

export interface Publication extends Hideable {
  id: string;
  title: string;
  authors: string[]; // List of authors
  year: number;
  venue: string; // Journal name or Conference name
  type: PublicationType;
  rank: Rank; // Custom tag for sorting/display
  impactFactor?: string; // Optional: Impact Factor (e.g. "10.5")
  image?: string; // Optional URL for thumbnail
  links?: {
    pdf?: string;
    code?: string;
    doi?: string;
    abs?: string;
  };
  highlight?: boolean; // If true, maybe show a red border or distinct style
}

export interface Project extends Hideable {
  id: string;
  title: string;
  description: string;
  year: string; // Can be a range "2023-Present"
  level: string; // e.g., "National Key Project", "University Project"
  image?: string;
  role: string; // e.g., "Project Leader"
}

export interface Talk extends Hideable {
  id: string;
  title: string;
  date: string;
  host: string;
  location: string;
  collaborators?: string;
  event?: string; // e.g., "AI Seminar Series"
}

export interface Education {
  degree: string;
  institution: string;
  location: string;
  year: string; // "2023 - 2025" or "2023"
  details?: string[]; // Thesis title, GPA, etc.
}

export interface Award extends Hideable {
  id: string;
  title: string;
  date: string;
  year: number;
  issuer: string;
  type: AwardType;
  level?: string; // e.g. "First Prize", "Gold Medal"
  prize?: string; // e.g. "¥20,000", "$1,000"
  image?: string;
}

export interface Experience extends Hideable {
  id: string;
  category: ExperienceCategory;
  title: string; // Degree (Edu) or Role (Work/Vol)
  institution: string; // University or Company
  location: string;
  date: string; // e.g. "Sep. 2023 - Present"
  image?: string; // Logo
  
  // Education Specific
  department?: string; // e.g. "School of Information Science"
  gpa?: string;
  rank?: string; // e.g. "Top 5%"
  
  // Work/Volunteer Specific
  description?: string;
}

export interface Language {
  language: string;
  proficiency: string; // e.g. "Native", "JLPT N1", "TOEFL 100"
}

export interface Profile {
  name: {
    first: string;
    last: string;
    chinese?: string;
  };
  title: string;
  affiliation: string;
  email: string;
  bio: string[]; // Paragraphs
  avatar: string;
  socials: SocialLink[];
  // New fields for CV
  education: Education[];
  researchInterests: string[];
  awards: Award[]; // Used for CV summary
  skills: string[];
  languages: Language[];
}

export type ResultBlockKind = 'text' | 'figure' | 'table';

/** A block's compiled PDF. The bookkeeping fields stay in the private repository only. */
export interface ResultBlockOutput {
  /** Repository path, e.g. "results/res-abc/blk-xyz-1a2b3c4d.pdf"; published copies live under public/. */
  pdf: string;
  /** Page size in points. */
  width: number;
  height: number;
  /** Hash of everything the compile depended on; a different hash means the PDF is out of date. */
  inputHash?: string;
  /** Counter values at the end of the block, for the next block to continue from. */
  counters?: Record<string, number>;
  /** Labels this block defined: name → contents of \newlabel's second argument. */
  labels?: Record<string, string>;
}

export interface ResultBlock extends Hideable {
  id: string;
  kind: ResultBlockKind;
  /** LaTeX source; left out of the public snapshot. */
  source?: string;
  output?: ResultBlockOutput;
}

/** A paper on the results pages. Unpublished papers exist only in the private repository. */
export interface ResultPaper extends Hideable {
  id: string;
  /** Address of the paper's page: #/results/<slug>. */
  slug: string;
  title: string;
  authors: string[];
  /** Venue or status, e.g. "ICLR 2027 · under review". */
  venue?: string;
  year?: number;
  summary?: string;
  /** The paper's LaTeX preamble (\documentclass up to \begin{document}); private only. */
  preamble?: string;
  /** Attachment file names under results/<id>/files/ (style files, figures); private only. */
  files?: string[];
  /** Content hash of each attachment, so replacing a file recompiles the blocks that use it; private only. */
  fileHashes?: Record<string, string>;
  /** GitHub users who may view the paper while it is hidden (case-insensitive); private only, never sent to them. */
  viewers?: string[];
  /** GitHub users who may also edit its blocks, preamble and attachments; private only, never sent to them. */
  editors?: string[];
  /**
   * The GitHub account ID of everyone in `viewers` and `editors`, by lowercase user name. Access is checked
   * against these, because a user name that is given up can be registered by someone else. Private only.
   */
  collaboratorIds?: Record<string, number>;
  /**
   * Collaborators who changed this published paper since the owner last published it. Until the owner
   * publishes their edits, the site keeps showing the version from before them. Private only.
   */
  pendingReview?: string[];
  blocks: ResultBlock[];
}

export const BUILTIN_PAGES = ['about', 'experiences', 'publications', 'projects', 'talks', 'awards', 'cv', 'results'] as const;
export type BuiltinPage = (typeof BUILTIN_PAGES)[number];

interface NavBase extends Hideable {
  id: string;
  /** Text shown in the navigation bar. */
  label: string;
}

/** One entry of the navigation bar; the array order is the bar's order. */
export type NavItem =
  | (NavBase & { type: 'builtin'; page: BuiltinPage })
  | (NavBase & { type: 'page'; slug: string; title: string; body: string })
  | (NavBase & { type: 'link'; url: string });

export interface SiteContent {
  profile: Profile;
  news: NewsItem[];
  experiences: Experience[];
  publications: Publication[];
  projects: Project[];
  talks: Talk[];
  awards: Award[];
  navigation: NavItem[];
  /** Visitors get the published snapshot; the signed-in owner gets the private list. */
  results: ResultPaper[];
}

export type ListCollection =
  | 'news'
  | 'experiences'
  | 'publications'
  | 'projects'
  | 'talks'
  | 'awards'
  | 'navigation'
  | 'results';

export type ProfileSection = 'basics' | 'bio' | 'avatar' | 'socials';

/** What an edit button asks the edit mode to open. */
export type EditRequest =
  | { kind: 'edit'; collection: ListCollection; id: string }
  | { kind: 'add'; collection: ListCollection; preset?: Record<string, unknown> }
  | { kind: 'profile'; section: ProfileSection }
  | { kind: 'navigation' }
  /** Edit a block of a results paper, or add one of the given kind at the end. */
  | { kind: 'block'; paperId: string; blockId?: string; blockKind?: ResultBlockKind }
  /** A results paper's preamble and attachments. */
  | { kind: 'paperSettings'; paperId: string };