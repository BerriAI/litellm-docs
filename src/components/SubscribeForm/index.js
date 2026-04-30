import React from 'react';
import styles from './styles.module.css';

const LOOPS_FORM_URL = 'https://app.loops.so/api/newsletter-form/clgnvx22100kmib0fa5ikqbb8';

export default function SubscribeForm() {
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState('idle'); // idle | loading | success | error

  async function handleSubmit(e) {
    e.preventDefault();
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
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return <p className={`${styles.feedback} ${styles.success}`}>You're subscribed!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.row}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="krrish@berri.ai"
          required
          disabled={status === 'loading'}
          className={styles.input}
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
