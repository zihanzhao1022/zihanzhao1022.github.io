import React from 'react';
import { Mail, Github, Linkedin, MessageCircle, FileText } from 'lucide-react';

/**
 * The Overwatch logo traced in outline like the lucide icons beside it: the arc on top and the ring with the
 * two legs, apart as in the logo. The gaps are a little wider than the logo's so they stay open at 24 px.
 * Gray like the other icons; in the logo's orange and gray on hover (inside a `group`) or when `colored`.
 */
export const Overwatch: React.FC<{ className?: string; colored?: boolean }> = ({ className, colored = false }) => (
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
    <path
      className={colored ? 'stroke-[#F99E1A]' : 'group-hover:stroke-[#F99E1A]'}
      d="M6.09 3.32A10.5 10.5 0 0 1 17.91 3.32L15.91 5.62A7.48 7.48 0 0 0 8.09 5.62Z"
    />
    <path
      className={colored ? 'stroke-[#4A4C4F]' : 'group-hover:stroke-[#4A4C4F]'}
      d="M4.28 4.89A10.5 10.5 0 1 0 19.72 4.89L17.72 7.19A7.48 7.48 0 0 1 18.53 15.66L14.45 11.7 13.15 7.32V14.63L16.56 17.93A7.48 7.48 0 0 1 7.44 17.93L10.85 14.63V7.32L9.55 11.7 5.47 15.66A7.48 7.48 0 0 1 6.28 7.19Z"
    />
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