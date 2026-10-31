import React, {createContext, lazy, Suspense, useCallback, useContext, useRef, useState} from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import DockedPanel from '../AskAI/DockedPanel';
import {useSalesForm} from '@site/src/components/SalesForm';
import styles from '../AskAI/styles.module.css';

const Chat = lazy(() => import('@inkeep/cxkit-react').then(module => ({default: module.InkeepEmbeddedChat})));
const InkeepContext = createContext(null);
export const useInkeep = () => useContext(InkeepContext);

// The embedded chat is built to float as a centered card. Inside the panel it should fill the
// height, with the input at the bottom, and drop the card shadow. Its root div carries an inline
// height: inherit, hence !important.
const fillPanel = {key: 'fill-panel', type: 'style', value: `div:has(> .inkeep-widget-vars) {height: 100% !important;}
.ikp-ai-chat-wrapper {
  width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; border-radius: 0; box-shadow: none;
}`};

// Inkeep answers inside the same docked right-hand panel as the internal chat. The chat loads on
// first open and then stays mounted while hidden, so the conversation survives closing and
// client-side navigation.
export function InkeepProvider({apiKey, children}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const functions = useRef(null);
  const pendingQuestion = useRef('');
  const salesForm = useSalesForm();
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
  const close = () => setOpen(false);

  return <InkeepContext.Provider value={{open, openPanel, closePanel: close, toggle: () => open ? close() : openPanel()}}>
    {children}
    {loaded && <BrowserOnly>{() => <DockedPanel open={open} onClose={close}>
      <div className={styles.inkeep}>
        <Suspense fallback={<p className={styles.thinking}>Loading chat…</p>}>
          <Chat
            baseSettings={{apiKey, organizationDisplayName: 'liteLLM', primaryBrandColor: '#4965f5', theme: {styles: [fillPanel]},
              colorMode: {sync: {target: 'html', attributes: ['data-theme'], isDarkMode: attributes => attributes['data-theme'] === 'dark'}}}}
            aiChatSettings={{aiAssistantName: 'LiteLLM AI', chatSubjectName: 'LiteLLM', chatFunctionsRef,
              aiAssistantAvatar: '/img/brand/litellm-monogram-blue.svg', placeholder: 'Ask anything about LiteLLM...'}}
          />
        </Suspense>
      </div>
      <p className={styles.inkeepHuman}>Need a person? <button type="button" onClick={() => salesForm.open({source: 'ask-ai-panel'})}>Talk to sales</button>
        {' '}or ask the community on <a href="https://litellmossslack.slack.com/" target="_blank" rel="noopener noreferrer">Slack</a>
        {' '}or <a href="https://discord.com/invite/wuPM9dRgDw" target="_blank" rel="noopener noreferrer">Discord</a>.</p>
    </DockedPanel>}</BrowserOnly>}
  </InkeepContext.Provider>;
}
