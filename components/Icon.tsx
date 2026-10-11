import React from 'react';
import { Mail, Github, Linkedin, MessageCircle, FileText } from 'lucide-react';

/**
 * The Overwatch logo traced in outline like the lucide icons beside it: the ring, the separate arc on top
 * and the two legs that join it. The gap between the legs is a little wider than the logo's so it stays
 * open at 24 px.
 */
const Overwatch: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M5.14 4.05A10.5 10.5 0 0 1 18.86 4.05L16.87 6.34A7.48 7.48 0 0 0 7.13 6.34Z" />
    <path d="M5.14 4.05A10.5 10.5 0 1 0 18.86 4.05L16.87 6.34A7.48 7.48 0 0 1 18.53 15.66L14.45 11.7 13.15 7.32V14.63L16.56 17.93A7.48 7.48 0 0 1 7.44 17.93L10.85 14.63V7.32L9.55 11.7 5.47 15.66A7.48 7.48 0 0 1 7.13 6.34Z" />
  </svg>
);

export const IconMap = {
  email: Mail,
  github: Github,
  linkedin: Linkedin,
  orcid: FileText, // Approximation
  wechat: MessageCircle,
  overwatch: Overwatch,
};

interface IconProps {
  name: keyof typeof IconMap;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ name, className }) => {
  const IconComponent = IconMap[name];
  if (!IconComponent) return null;
  return <IconComponent className={className} />;
};