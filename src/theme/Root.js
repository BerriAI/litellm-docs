import React from 'react';
import {SalesFormProvider} from '@site/src/components/SalesForm';

// Mounts the Enterprise request dialog once for every page, so any
// "Talk to sales" or trial link can open it.
export default function Root({children}) {
  return <SalesFormProvider>{children}</SalesFormProvider>;
}
