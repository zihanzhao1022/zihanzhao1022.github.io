export type PublicationType = 'journal' | 'conference';
export type Rank = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'CORE-A*' | 'CORE-A' | 'CORE-B' | 'CORE-C' | 'Unranked';
export type AwardType = 'international' | 'national' | 'provincial' | 'scholarship';
export type ExperienceCategory = 'education' | 'work' | 'volunteer';

export interface SocialLink {
  platform: 'email' | 'github' | 'linkedin' | 'orcid' | 'wechat' | 'overwatch';
  url: string;
  label?: string;
  qrCode?: string; // Optional: URL to QR code image (e.g. for WeChat)
}

/** List items can be hidden: kept in the data, left out for visitors. */
interface Hideable {
  hidden?: boolean;
}

/**
 * The owner's Chinese and Japanese versions of some of an item's text, shown instead of the English while the
 * site is in that language (lib/localize). A version may leave fields out; those show the English.
 */
export interface Translations<T> {
  zh?: Partial<T>;
  ja?: Partial<T>;
}

export interface NewsItem extends Hideable {
  id: string;
  date: string;
  content: string;
  i18n?: Translations<Pick<NewsItem, 'content'>>;
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
  i18n?: Translations<Pick<Project, 'title' | 'role' | 'description' | 'level'>>;
}

export interface Talk extends Hideable {
  id: string;
  title: string;
  date: string;
  host: string;
  location: string;
  collaborators?: string;
  event?: string; // e.g., "AI Seminar Series"
  i18n?: Translations<Pick<Talk, 'title' | 'event' | 'host' | 'location' | 'collaborators'>>;
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
  i18n?: Translations<Pick<Award, 'title' | 'issuer' | 'level'>>;
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
  i18n?: Translations<Pick<Experience, 'title' | 'institution' | 'department' | 'location' | 'rank' | 'description'>>;
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
  /** Competitive ranks the Overwatch icon shows under the bio's second paragraph. */
  overwatch?: OverwatchRank[];
  i18n?: Translations<Pick<Profile, 'title' | 'affiliation' | 'bio' | 'languages'>>;
}

export interface OverwatchRank {
  role: 'tank' | 'damage' | 'support';
  /** e.g. "Grandmaster". */
  tier: string;
  /** 1 (highest) to 5. */
  division: number;
}

/** Blocks of LaTeX, each compiled to a PDF. */
export type PdfBlockKind = 'text' | 'figure' | 'table';
export type ResultBlockKind = PdfBlockKind | 'heading';

export type HeadingLevel = 'section' | 'subsection' | 'subsubsection' | 'paragraph';

/** A section heading on a results page, shown as HTML rather than a PDF. */
export interface ResultHeading {
  level: HeadingLevel;
  /** Unnumbered, like \section*. */
  starred?: boolean;
  /** One line, exported to LaTeX as is. */
  title: string;
  /** For \ref from the blocks, e.g. "sec:method"; numbered headings only. Private only. */
  label?: string;
  /** The appendix starts here (\appendix): sections from here on are lettered. Sections only; private only. */
  appendix?: boolean;
}

/** What compiling a heading gives; no PDF is kept. */
export interface HeadingNumbering {
  /** Private only, like the counters and labels. */
  inputHash?: string;
  counters?: Record<string, number>;
  labels?: Record<string, string>;
  /** The number LaTeX prints, e.g. "2.1" or "A"; absent when the heading has none. */
  number?: string;
  /** hyperref's anchor, e.g. "subsection.2.1", so \ref links can jump to the heading. */
  anchor?: string;
}

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
  /** The figure or table number for the outline, e.g. "3"; only in what publicView gives. */
  number?: string;
}

/**
 * Who may view every paper of the results pages, on top of each paper's own lists (results-access.json in the
 * private repository; never sent to anyone but the owner).
 */
export interface ResultsSiteAccess {
  viewers?: string[];
  /** GitHub account ID of each listed user name (lowercase), like a paper's collaboratorIds. */
  collaboratorIds?: Record<string, number>;
}

/** A paper's bibliography: the entries its blocks cite, typeset from references.bib under "References". */
export interface ResultReferences extends ResultBlockOutput {
  /** What the bibliography's \bibcite says for each cited key, so the blocks' \cite can show it. Private only. */
  citations?: Record<string, string>;
}

export interface ResultBlock extends Hideable {
  id: string;
  kind: ResultBlockKind;
  /** LaTeX source; left out of the public snapshot. Headings have none. */
  source?: string;
  output?: ResultBlockOutput;
  /** Kind 'heading' only. */
  heading?: ResultHeading;
  numbering?: HeadingNumbering;
}

/** Someone who wrote a comment: GitHub user name and account ID. */
export interface CommentAuthor {
  login: string;
  id: number;
}

/**
 * A comment thread on a results paper, on a block or on text selected in it. The presence room keeps them
 * (Cloudflare storage, not the repositories) and shows them only to people who may view the paper.
 */
export interface ResultComment {
  id: string;
  paper: string;
  /** A block ID, or "references" for the bibliography. */
  block: string;
  /** The selected text and a little of what surrounds it, to find it again after a recompile. */
  quote?: string;
  prefix?: string;
  suffix?: string;
  author: CommentAuthor;
  /** Epoch milliseconds. */
  at: number;
  text: string;
  replies: ResultCommentReply[];
  resolved?: { login: string; at: number };
}

export interface ResultCommentReply {
  id: string;
  author: CommentAuthor;
  at: number;
  text: string;
}

/** What a reader asks the presence room to do with the comments of the paper they have open. */
export type CommentOp =
  | { kind: 'add'; block: string; text: string; quote?: string; prefix?: string; suffix?: string }
  | { kind: 'reply'; thread: string; text: string }
  | { kind: 'delete'; thread: string; reply?: string }
  | { kind: 'resolve'; thread: string; resolved: boolean };

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
  /** Set once the paper has references.bib and its blocks cite entries of it; shown after the blocks. */
  references?: ResultReferences;
}

export const BUILTIN_PAGES = ['about', 'experiences', 'publications', 'projects', 'talks', 'awards', 'cv', 'results'] as const;
export type BuiltinPage = (typeof BUILTIN_PAGES)[number];

interface NavBase extends Hideable {
  id: string;
  /** Text shown in the navigation bar. */
  label: string;
  /** A custom page's title and body can be translated too. */
  i18n?: Translations<{ label: string; title: string; body: string }>;
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
  /** Edit a block, or add one after `afterBlockId` (at the end when omitted). */
  | { kind: 'block'; paperId: string; blockId?: string; blockKind?: PdfBlockKind; afterBlockId?: string }
  /** A results paper's preamble and attachments. */
  | { kind: 'paperSettings'; paperId: string }
  /** A results paper's references.bib. */
  | { kind: 'references'; paperId: string }
  /** Edit a section heading, or add one after `afterBlockId` (at the end when omitted). */
  | { kind: 'heading'; paperId: string; blockId?: string; afterBlockId?: string };
