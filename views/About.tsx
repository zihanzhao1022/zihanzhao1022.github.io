import React, { useState } from 'react';
import { profile } from '../data';
import { Icon } from '../components/Icon';

const About: React.FC = () => {
  const [activeQr, setActiveQr] = useState<string | null>(null);

  const toggleQr = (platform: string) => {
    setActiveQr(prev => prev === platform ? null : platform);
  };

  return (
    <div className="animate-fade-in">
      {/* Header Section: Name, Title, Languages */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-1">
          {profile.name.first} <span className="font-light">{profile.name.last}</span>
        </h1>
        <p className="text-sm text-gray-500 mb-4">
          {profile.title} at <span className="text-purple-600">{profile.affiliation}</span>
        </p>

        {/* Languages Section */}
        {profile.languages && profile.languages.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 items-center">
                {profile.languages.map((lang) => (
                  <div key={lang.language} className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{lang.language}</span>
                    <span className="text-gray-300 text-xs">/</span>
                    <span className="font-light">{lang.proficiency}</span>
                  </div>
                ))}
            </div>
        )}
      </div>

      {/* Main Content: Bio (Left) & Photo (Right) - Top Aligned */}
      <div className="flex flex-col md:flex-row gap-12 mb-8 items-start">

        {/* Left: Bio */}
        <div className="flex-1 order-2 md:order-1">
          <div className="text-gray-700 space-y-4 text-justify font-light mb-8">
            {profile.bio.map((paragraph, idx) => (
              <p key={idx} dangerouslySetInnerHTML={{ __html: paragraph }} />
            ))}
          </div>
        </div>

        {/* Right: Photo & Socials */}
        {/* Adjusted width to md:w-72 (approx 288px) for a better standard portrait size */}
        <div className="w-full md:w-60 flex-shrink-0 order-1 md:order-2 flex flex-col items-center">
          <div className="relative group w-full">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-100 to-gray-100 rounded-lg blur opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
            <img
              src={profile.avatar}
              alt="Profile"
              /* Removed grayscale classes. Use h-auto to keep aspect ratio, or h-96 to force height. */
              className="relative w-full h-auto rounded-lg shadow-lg object-cover transition-all duration-500"
            />
          </div>

          {/* Social Icons */}
          <div className="flex gap-6 mt-6 relative z-20 justify-center">
            {profile.socials.map((social) => {
              const hasQr = !!social.qrCode;
              const isActive = activeQr === social.platform;

              return (
                <div key={social.platform} className="relative group">
                  {/* Floating Bubble Popover */}
                  {hasQr && isActive && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-40 p-2 bg-white rounded-lg shadow-xl border border-gray-100 animate-[fadeIn_0.2s_ease-out] z-50">
                      {/* QR Image */}
                      <img
                        src={social.qrCode}
                        alt={`${social.platform} QR`}
                        className="w-full h-auto rounded block"
                      />

                      <div className="text-center text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-medium">
                        Scan to Add
                      </div>

                      {/* Little Triangle/Arrow pointing down */}
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-gray-100 transform rotate-45"></div>
                    </div>
                  )}

                  <a
                    href={social.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (hasQr) {
                        e.preventDefault();
                        toggleQr(social.platform);
                      }
                    }}
                    className={`block transition-colors transform hover:scale-110 ${
                      isActive ? 'text-purple-600' : 'text-gray-400 hover:text-purple-600'
                    }`}
                  >
                    <Icon name={social.platform} className="w-6 h-6" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* News Section */}
      <div className="border-t border-gray-100 pt-6">
        <h2 className="text-2xl font-light text-gray-900 mb-6">news</h2>
        <div className="space-y-4">
          {profile.news.map((item, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:gap-8 text-sm">
              <div className="font-bold text-gray-900 min-w-[100px]">{item.date}</div>
              <div className="text-gray-600">{item.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default About;