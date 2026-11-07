import React, {createContext, lazy, Suspense, useCallback, useContext, useRef, useState} from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import {useHistory} from '@docusaurus/router';
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

// Answers link with full docs.litellm.ai URLs. Those move the page through the router, so the
// panel and its conversation stay put while the docs change beside them. Other sites, files and
// modified clicks still open in a new tab.
function followLink(event, history) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.nativeEvent.composedPath().find(node => node.tagName === 'A' && node.href);
  if (!link) return;
  const url = new URL(link.href, window.location.href);
  const docsPage = (url.origin === window.location.origin || url.hostname === 'docs.litellm.ai') && !/\.[a-z0-9]+$/i.test(url.pathname);
  if (!docsPage && link.target === '_blank') return;
  event.preventDefault();
  if (docsPage) history.push(url.pathname + url.search + url.hash);
  else window.open(url.href, '_blank', 'noopener');
}

// Inkeep answers inside the same docked right-hand panel as the internal chat. The chat loads on
// first open and then stays mounted while hidden, so the conversation survives closing and
// client-side navigation.
export function InkeepProvider({apiKey, children}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const functions = useRef(null);
  const pendingQuestion = useRef('');
  const salesForm = useSalesForm();
  const history = useHistory();
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
      <div className={styles.inkeep} onClick={event => followLink(event, history)}>
        <Suspense fallback={<p className={styles.thinking}>Loading chat…</p>}>
          <Chat
            baseSettings={{apiKey, organizationDisplayName: 'liteLLM', primaryBrandColor: '#4965f5', theme: {styles: [fillPanel]},
              colorMode: {sync: {target: 'html', attributes: ['data-theme'], isDarkMode: attributes => attributes['data-theme'] === 'dark'}}}}
            aiChatSettings={{aiAssistantName: 'LiteLLM AI', chatSubjectName: 'LiteLLM', chatFunctionsRef,
              aiAssistantAvatar: '/img/brand/litellm-monogram-blue.svg', placeholder: 'Ask anything about LiteLLM...',
              shouldOpenLinksInNewTab: false}}
          />
        </Suspense>
      </div>
      <p className={styles.inkeepHuman}>Need a person? <button type="button" onClick={() => salesForm.open({source: 'ask-ai-panel'})}>Talk to sales</button>
        {' '}or ask the community on <a href="https://litellmossslack.slack.com/" target="_blank" rel="noopener noreferrer">Slack</a>
        {' '}or <a href="https://discord.com/invite/wuPM9dRgDw" target="_blank" rel="noopener noreferrer">Discord</a>.</p>
    </DockedPanel>}</BrowserOnly>}
  </InkeepContext.Provider>;
}
