import React from 'react';

export function SectionHeading({id, kicker, title}) {
  return (
    <header className="rm-sectionHeading">
      <p className="rm-kicker">{kicker}</p>
      <h2 id={id}>{title}</h2>
    </header>
  );
}
