import React from 'react';

/** Comma-separated authors; names written as **Name** (the owner) are bold and underlined, as on the publications page. */
const Authors: React.FC<{ authors: string[] }> = ({ authors }) => (
  <span>
    {authors.map((author, index) => {
      const name = author.replace(/\*\*/g, '');
      return (
        <React.Fragment key={`${author}-${index}`}>
          {author.includes('**') ? <strong className="font-bold underline decoration-2 underline-offset-2">{name}</strong> : name}
          {index < authors.length - 1 ? ', ' : ''}
        </React.Fragment>
      );
    })}
  </span>
);

export default Authors;
