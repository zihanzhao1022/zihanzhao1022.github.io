import React from 'react';
import { Mail, Github, Linkedin, MessageCircle, FileText } from 'lucide-react';

/** The Overwatch emblem drawn like the lucide icons beside it: a ring open at the top with a W inside. */
const Overwatch: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M8.63 3.66A9 9 0 1 0 15.37 3.66" />
    <path d="M8.63 3.66 11 12.5" />
    <path d="M15.37 3.66 13 12.5" />
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