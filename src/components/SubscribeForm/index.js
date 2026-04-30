import React from 'react';
import {LOOPS_FORM_URL} from '@site/src/config';
import styles from './styles.module.css';


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
    return <p className={`${styles.feedback} ${styles.success}`}>We'll keep you posted!</p>;
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.row}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
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
