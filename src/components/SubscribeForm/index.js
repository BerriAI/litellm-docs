import React from 'react';
import clsx from 'clsx';
import {LOOPS_FORM_URL} from '@site/src/config';
import styles from './styles.module.css';

// PostHog is loaded in production only; a no-op elsewhere.
function track(event, props) {
  try {
    window.posthog?.capture?.(event, {path: window.location.pathname, ...props});
  } catch {
    // analytics must never break the form
  }
}

// The Loops newsletter signup. `source` records where on the site someone
// subscribed (blog, footer, release notes, quickstart); `tone="dark"` suits
// the navy footer.
export default function SubscribeForm({source = 'blog', tone = 'light', className}) {
  const [email, setEmail] = React.useState('');
  const [honeypot, setHoneypot] = React.useState('');
  const [status, setStatus] = React.useState('idle'); // idle | loading | success | error

  async function handleSubmit(e) {
    e.preventDefault();
    if (honeypot) return;
    setStatus('loading');
    try {
      const res = await fetch(LOOPS_FORM_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({email}),
      });
      if (res.ok) {
        setStatus('success');
        setEmail('');
        track('docs_newsletter_subscribed', {source});
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return <p className={clsx(styles.feedback, styles.success)}>You're on the list. Watch your inbox for the next update.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={clsx(styles.form, tone === 'dark' && styles.dark, className)}>
      <input
        type="text"
        value={honeypot}
        onChange={e => setHoneypot(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        style={{position:'absolute',left:'-9999px',width:'1px',height:'1px',opacity:0}}
        name="website"
        autoComplete="off"
      />
      <div className={styles.row}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={status === 'loading'}
          className={styles.input}
          aria-label="Email address"
        />
        <button type="submit" disabled={status === 'loading'} className={styles.btn}>
          {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
        </button>
      </div>
      {status === 'error' && (
        <p className={`${styles.feedback} ${styles.error}`}>Something went wrong. Try again.</p>
      )}
    </form>
  );
}
