import React from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {InkeepProvider} from '@site/src/components/Inkeep';
import {SalesFormProvider} from '@site/src/components/SalesForm';
import {AskAIProvider} from '@site/src/components/AskAI/AskAIContext';
import AskAIPanel from '@site/src/components/AskAI/AskAIPanel';
import PlaygroundCaseLinks from '@site/src/components/PlaygroundCaseLinks';

// Mounts the Enterprise request dialog and the Ask AI chat once for every page, so any
// "Talk to sales" or trial link can open the dialog and the chat panel survives navigation.
// Router playground case links open their case in a modal over the page.
export default function Root({children}) {
  const {siteConfig} = useDocusaurusContext();
  if (siteConfig.customFields.inkeepApiKey) return <SalesFormProvider>
    <InkeepProvider apiKey={siteConfig.customFields.inkeepApiKey}>{children}</InkeepProvider>
    <PlaygroundCaseLinks />
  </SalesFormProvider>;

  return <SalesFormProvider>
    <AskAIProvider>
      {children}
      <AskAIPanel />
      <PlaygroundCaseLinks />
    </AskAIProvider>
  </SalesFormProvider>;
}
