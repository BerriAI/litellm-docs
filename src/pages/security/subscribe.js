import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import ThemedImage from '@theme/ThemedImage';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {
  LOOPS_FORM_URL,
  LOOPS_SECURITY_MAILING_LIST,
  LOOPS_SECURITY_USER_GROUP,
} from '@site/src/config';
import styles from './subscribe.module.css';

const DESCRIPTION =
  'Get an email when LiteLLM has urgent security news, such as an out-of-band release for a severe CVE.';

function SignupForm() {
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
        body: new URLSearchParams({
          email,
          mailingLists: LOOPS_SECURITY_MAILING_LIST,
          userGroup: LOOPS_SECURITY_USER_GROUP,
        }),
      });
      setStatus(res.ok ? 'success' : 'error');
      if (res.ok) setEmail('');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <p className={styles.success} role="status">
        You're subscribed. We'll email you when there is a security issue you should know about.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input
        type="text"
        value={honeypot}
        onChange={e => setHoneypot(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className={styles.honeypot}
        name="website"
        autoComplete="off"
      />
      <label htmlFor="security-email" className={styles.srOnly}>
        Email address
      </label>
      <input
        id="security-email"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        disabled={status === 'loading'}
        className={styles.input}
      />
      <button type="submit" disabled={status === 'loading'} className={styles.button}>
        {status === 'loading' ? 'Subscribing…' : 'Subscribe to security announcements'}
      </button>
      {status === 'error' && (
        <p className={styles.error} role="alert">
          Something went wrong. Try again.
        </p>
      )}
    </form>
  );
}

export default function SecuritySubscribe() {
  return (
    <Layout title="Security announcements" description={DESCRIPTION}>
      <main className={styles.page}>
        <div className={styles.card}>
          <ThemedImage
            className={styles.logo}
            alt="LiteLLM"
            sources={{
              light: useBaseUrl('/img/brand/litellm-logo-blue.png'),
              dark: useBaseUrl('/img/brand/litellm-logo-white.png'),
            }}
          />
          <h1 className={styles.title}>Security announcements</h1>
          <p className={styles.description}>
            Get notified when we have urgent security news, such as an upcoming out-of-band release for a
            severe CVE in LiteLLM. Low volume: we only email when there is a security issue you should
            know about.
          </p>
          <SignupForm />
          <p className={styles.note}>Security notices only. No marketing, and you can unsubscribe at any time.</p>
        </div>
        <nav className={styles.links} aria-label="Security resources">
          <Link href="https://github.com/BerriAI/litellm/security/policy">Security policy</Link>
          <span aria-hidden="true">·</span>
          <Link to="/docs/proxy/security_best_practices">Security best practices</Link>
          <span aria-hidden="true">·</span>
          <Link href="https://github.com/BerriAI/litellm">GitHub</Link>
          <span aria-hidden="true">·</span>
          <Link href="https://www.litellm.ai">litellm.ai</Link>
        </nav>
      </main>
    </Layout>
  );
}
