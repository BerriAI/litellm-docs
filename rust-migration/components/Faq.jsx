import React, {useEffect, useRef} from 'react';
import {RolloutStages} from './Stages';
import {SectionHeading} from './SectionHeading';

const FAQ = [
  {id: 'faq-rollout-stages', question: 'How does a feature move to Rust?', answer: <RolloutStages />},
];

// A malformed escape like `#%` reads as no hash rather than breaking the FAQ.
function hashId() {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return '';
  }
}

// Point the URL at an open answer so it can be shared, without adding a history
// entry per toggle. A deeper link already inside the answer, like a stage, is
// kept while it is open and cleared when it closes, so following the same link
// again fires `hashchange` and reopens it.
function syncHash(details) {
  const current = hashId();
  const pointsInside = Boolean(current) && details.contains(document.getElementById(current));
  const {pathname, search} = window.location;
  if (details.open && !pointsInside) {
    window.history.replaceState(window.history.state, '', `${pathname}${search}#${details.id}`);
  } else if (!details.open && pointsInside) {
    window.history.replaceState(window.history.state, '', `${pathname}${search}`);
  }
}

// Answers start collapsed, and each one is addressable as `#<id>`. A link to an
// answer, or to something inside one like a stage badge's "What this means",
// opens it first so the target is visible.
export function Faq() {
  const listRef = useRef(null);
  useEffect(() => {
    const openHashTarget = () => {
      const id = hashId();
      const target = id && document.getElementById(id);
      const details = target && listRef.current?.contains(target) && target.closest('details');
      if (details && !details.open) {
        details.open = true;
        target.scrollIntoView();
      }
    };
    openHashTarget();
    window.addEventListener('hashchange', openHashTarget);
    return () => window.removeEventListener('hashchange', openHashTarget);
  }, []);

  return (
    <section className="rm-section" id="faq" aria-labelledby="faq-title">
      <SectionHeading id="faq-title" kicker="FAQ" title="Frequently asked questions" />
      <ul className="rm-faq" ref={listRef}>
        {FAQ.map(item => (
          <li key={item.id}>
            <details className="rm-faqItem" id={item.id} onToggle={event => syncHash(event.currentTarget)}>
              <summary className="rm-faqQuestion">
                {item.question}
                <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
              </summary>
              <div className="rm-faqAnswer">{item.answer}</div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
