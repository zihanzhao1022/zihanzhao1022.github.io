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

export interface NewsItem {
  date: string;
  content: string;
}

export interface Publication {
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

export interface Project {
  id: string;
  title: string;
  description: string;
  year: string; // Can be a range "2023-Present"
  level: string; // e.g., "National Key Project", "University Project"
  image?: string;
  role: string; // e.g., "Project Leader"
}

export interface Talk {
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

export interface Award {
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

export interface Experience {
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
  news: NewsItem[];
  // New fields for CV
  education: Education[];
  researchInterests: string[];
  awards: Award[]; // Used for CV summary
  skills: string[];
  languages: Language[];
}