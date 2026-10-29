import React, {createContext, lazy, Suspense, useCallback, useContext, useRef, useState} from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';

const Modal = lazy(() => import('@inkeep/cxkit-react').then(module => ({default: module.InkeepModalChat})));
const InkeepContext = createContext(null);
export const useInkeep = () => useContext(InkeepContext);

export function InkeepProvider({apiKey, children}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const functions = useRef(null);
  const pendingQuestion = useRef('');
  const openPanel = question => {
    if (typeof question === 'string' && question.trim()) pendingQuestion.current = question.trim();
    setLoaded(true);
    setOpen(true);
    if (functions.current && pendingQuestion.current) {
      const message = pendingQuestion.current;
      pendingQuestion.current = '';
      functions.current.submitMessage(message);
    }
  };
  const chatFunctionsRef = useCallback(value => {
    functions.current = value;
    if (value && pendingQuestion.current) {
      const message = pendingQuestion.current;
      pendingQuestion.current = '';
      value.submitMessage(message);
    }
  }, []);

  return <InkeepContext.Provider value={{open, openPanel, toggle: () => open ? setOpen(false) : openPanel()}}>
    {children}
    {loaded && <BrowserOnly>{() => <Suspense fallback={null}>
      <Modal
        baseSettings={{apiKey, organizationDisplayName: 'liteLLM', primaryBrandColor: '#4965f5',
          colorMode: {sync: {target: 'html', attributes: ['data-theme'], isDarkMode: attributes => attributes['data-theme'] === 'dark'}}}}
        aiChatSettings={{aiAssistantName: 'LiteLLM AI', chatSubjectName: 'LiteLLM', chatFunctionsRef,
          aiAssistantAvatar: '/img/brand/litellm-monogram-blue.svg', placeholder: 'Ask anything about LiteLLM...'}}
        modalSettings={{isOpen: open, onOpenChange: setOpen, shortcutKey: null}}
      />
    </Suspense>}</BrowserOnly>}
  </InkeepContext.Provider>;
}
