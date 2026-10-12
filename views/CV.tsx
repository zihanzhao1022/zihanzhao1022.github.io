import React from 'react';
import { useLocalizedContent } from '../components/ContentContext';
import { Download } from 'lucide-react';
import { localDate } from '../lib/dates';
import { useLang } from '../lib/i18n';
import { useT } from '../lib/phrases/site';

const CV: React.FC = () => {
  const content = useLocalizedContent();
  const { profile } = content;
  const t = useT();
  const lang = useLang();
  // The CV is for printing, so hidden items never appear on it, not even while editing.
  const publications = content.publications.filter((item) => !item.hidden);
  const projects = content.projects.filter((item) => !item.hidden);
  const talks = content.talks.filter((item) => !item.hidden);
  // Sort publications by year desc for the CV
  const sortedPubs = [...publications].sort((a, b) => b.year - a.year);
  const journals = sortedPubs.filter(p => p.type === 'journal');
  const conferences = sortedPubs.filter(p => p.type === 'conference');

  const formatAuthors = (authors: string[]) => {
    return authors.map((author, idx) => {
      const isMe = author.includes("**");
      const cleanName = author.replace(/\*\*/g, "");
      return (
        <span key={idx}>
          {isMe ? <strong>{cleanName}</strong> : cleanName}
          {idx < authors.length - 1 ? ", " : ""}
        </span>
      );
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="animate-fade-in pb-20">
      {/* Print Button (Hidden when printing) */}
      <div className="mb-8 flex justify-end print:hidden">
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          {t('下载 PDF')}
        </button>
      </div>

      {/* CV Container - resembles a paper document */}
      <div className="max-w-[210mm] mx-auto bg-white print:max-w-none print:mx-0">
        
        {/* Header */}
        <header className="border-b-2 border-gray-900 pb-6 mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 uppercase tracking-tight">
            {profile.name.first} {profile.name.last}
          </h1>
          <div className="text-sm text-gray-600 flex flex-wrap gap-x-6 gap-y-1">
             <span>{profile.title}</span>
             <span>{profile.affiliation}</span>
             <a href={`mailto:${profile.email}`} className="text-gray-900 hover:underline">{profile.email}</a>
             {profile.socials.find(s => s.platform === 'github') && (
               <a href={profile.socials.find(s => s.platform === 'github')?.url} className="text-gray-900 hover:underline">Github</a>
             )}
          </div>
        </header>

        {/* Education */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-200 mb-4 pb-1">{t('教育经历')}</h2>
          <div className="space-y-4">
            {profile.education.map((edu, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row justify-between">
                 <div>
                   <h3 className="font-bold text-gray-900">{edu.institution}</h3>
                   <div className="text-gray-700 italic">{edu.degree}</div>
                   {edu.details && (
                     <ul className="list-disc list-inside text-sm text-gray-600 mt-1 pl-1">
                       {edu.details.map((detail, dIdx) => (
                         <li key={dIdx}>{detail}</li>
                       ))}
                     </ul>
                   )}
                 </div>
                 <div className="text-right shrink-0">
                   <div className="font-medium text-gray-900">{edu.location}</div>
                   <div className="text-sm text-gray-500">{localDate(edu.year, lang)}</div>
                 </div>
              </div>
            ))}
          </div>
        </section>

        {/* Research Interests */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-200 mb-4 pb-1">{t('研究兴趣')}</h2>
          <div className="flex flex-wrap gap-2">
            {profile.researchInterests.map((interest, idx) => (
              <span key={idx} className="bg-gray-100 px-3 py-1 rounded text-sm text-gray-700">
                {interest}
              </span>
            ))}
          </div>
        </section>

        {/* Publications */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-200 mb-4 pb-1">{t('论文')}</h2>
          
          {journals.length > 0 && (
            <div className="mb-4">
              <h3 className="text-md font-semibold text-gray-800 mb-2">{t('期刊论文（同行评审）')}</h3>
              <ul className="list-decimal list-outside ml-5 space-y-3 text-sm text-gray-800">
                {journals.map((pub) => (
                  <li key={pub.id} className="pl-1">
                    <span className="block">
                      {formatAuthors(pub.authors)}.
                      "<strong>{pub.title}</strong>".
                      {' '} <span className="italic">{pub.venue}</span>, {pub.year}.
                      {' '}<span className="text-xs font-mono bg-gray-100 px-1 rounded">{pub.rank}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conferences.length > 0 && (
            <div>
              <h3 className="text-md font-semibold text-gray-800 mb-2">{t('会议论文集')}</h3>
              <ul className="list-decimal list-outside ml-5 space-y-3 text-sm text-gray-800">
                {conferences.map((pub) => (
                  <li key={pub.id} className="pl-1">
                    <span className="block">
                       {formatAuthors(pub.authors)}.
                      "<strong>{pub.title}</strong>".
                      In <span className="italic">{pub.venue}</span>, {pub.year}.
                      {' '}<span className="text-xs font-mono bg-gray-100 px-1 rounded">{pub.rank}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Selected Projects */}
        <section className="mb-8">
           <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-200 mb-4 pb-1">{t('代表性项目')}</h2>
           <div className="space-y-4">
             {projects.map((proj) => (
               <div key={proj.id}>
                 <div className="flex justify-between items-baseline mb-1">
                   <h3 className="font-bold text-gray-900 text-sm">{proj.title} <span className="font-normal text-gray-600 italic">- {proj.role}</span></h3>
                   <span className="text-xs text-gray-500">{localDate(proj.year, lang)}</span>
                 </div>
                 <p className="text-sm text-gray-700">{proj.description}</p>
                 <div className="text-xs text-gray-500 mt-1">{proj.level}</div>
               </div>
             ))}
           </div>
        </section>

        {/* Invited Talks */}
        <section className="mb-8">
           <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-200 mb-4 pb-1">{t('受邀报告')}</h2>
           <ul className="space-y-3 text-sm text-gray-800">
             {talks.map((talk) => (
               <li key={talk.id} className="grid grid-cols-[1fr_auto] gap-4">
                 <div>
                   <strong>{talk.title}</strong>. {talk.event ? `${talk.event}, ` : ''}{talk.location}.
                   <div className="text-xs text-gray-500 italic">
                     {t('主办：{host}', { host: talk.host })} {talk.collaborators ? t('（合作：{collaborators}）', { collaborators: talk.collaborators }) : ''}
                   </div>
                 </div>
                 <div className="whitespace-nowrap text-gray-500">{localDate(talk.date, lang)}</div>
               </li>
             ))}
           </ul>
        </section>

        {/* Honors & Awards */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-200 mb-4 pb-1">{t('荣誉与奖项')}</h2>
          <ul className="space-y-2 text-sm text-gray-800">
            {profile.awards.map((award, idx) => (
              <li key={idx} className="flex justify-between">
                <span>{award.title} {award.issuer && <span className="text-gray-500">- {award.issuer}</span>}</span>
                <span className="text-gray-500">{localDate(award.date, lang)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Skills & Languages */}
        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-200 mb-4 pb-1">{t('技术技能')}</h2>
            <div className="text-sm text-gray-800">
              <ul className="list-disc list-inside space-y-1">
                {profile.skills.map((skill, idx) => (
                  <li key={idx}>{skill}</li>
                ))}
              </ul>
            </div>
          </div>
          
          <div>
            <h2 className="text-lg font-bold text-gray-900 uppercase border-b border-gray-200 mb-4 pb-1">{t('语言')}</h2>
            <div className="text-sm text-gray-800">
               <ul className="space-y-1">
                {profile.languages.map((lang, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span className="font-semibold">{lang.language}</span>
                    <span className="text-gray-600">{lang.proficiency}</span>
                  </li>
                ))}
               </ul>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default CV;