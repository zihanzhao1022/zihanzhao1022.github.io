import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="w-full bg-gray-900 text-gray-400 py-6 text-center text-xs mt-20">
      <p>© Copyright {currentYear} Zihan ZHAO. Powered by React. Hosted by GitHub Pages.</p>
    </footer>
  );
};

export default Footer;