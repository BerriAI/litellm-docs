import React from 'react';
import Ferris from '@site/src/components/Ferris';

export default function Root({children}) {
  return (
    <>
      {children}
      <Ferris />
    </>
  );
}
