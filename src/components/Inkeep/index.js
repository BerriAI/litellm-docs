import React, {createContext, lazy, Suspense, useContext, useEffect, useState} from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {Search} from 'lucide-react';
import styles from '@site/src/theme/SearchBar/styles.module.css';

const Modal = lazy(() => import('@inkeep/cxkit-react').then(module => ({default: module.InkeepModalSearchAndChat})));
const InkeepContext = createContext(null);
export const useInkeep = () => useContext(InkeepContext);

export function InkeepProvider({apiKey, children}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('search');
  const [loaded, setLoaded] = useState(false);
  const show = nextView => {setView(nextView); setLoaded(true); setOpen(true);};

  useEffect(() => {
    const key = event => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.isComposing) {
        event.preventDefault(); show('search');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return <InkeepContext.Provider value={{open, view, show}}>
    {children}
    {loaded && <BrowserOnly>{() => <Suspense fallback={null}>
      <Modal key={view}
        baseSettings={{apiKey, organizationDisplayName: 'liteLLM', primaryBrandColor: '#4965f5',
          colorMode: {sync: {target: 'html', attributes: ['data-theme'], isDarkMode: attributes => attributes['data-theme'] === 'dark'}}}}
        aiChatSettings={{aiAssistantName: 'LiteLLM AI', chatSubjectName: 'LiteLLM',
          aiAssistantAvatar: '/img/brand/litellm-monogram-blue.svg', placeholder: 'Ask anything about LiteLLM...'}}
        searchSettings={{placeholder: 'Search docs, guides, API reference...'}}
        defaultView={view}
        forceDefaultView
        shouldShowAskAICard
        modalSettings={{isOpen: open, onOpenChange: setOpen, shortcutKey: null}}
      />
    </Suspense>}</BrowserOnly>}
  </InkeepContext.Provider>;
}

export function InkeepSearchButton() {
  const {show} = useInkeep();
  const [shortcut, setShortcut] = useState('Ctrl K');
  useEffect(() => {setShortcut(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K');}, []);
  return <button className={styles.trigger} onClick={() => show('search')} aria-label="Search for anything..."
    title={`Search (${shortcut})`} aria-keyshortcuts="Meta+k Control+k">
    <Search size={18}/><span>Search for anything...</span><kbd>{shortcut}</kbd>
  </button>;
}
