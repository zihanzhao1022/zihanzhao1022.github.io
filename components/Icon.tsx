import React from 'react';
import { Mail, Github, Linkedin, MessageCircle, FileText } from 'lucide-react';

export const IconMap = {
  email: Mail,
  github: Github,
  linkedin: Linkedin,
  orcid: FileText, // Approximation
  wechat: MessageCircle,
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