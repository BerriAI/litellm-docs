import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {SALES_EMBED_URL, SALES_URL, TRIAL_URL, withUtm} from './content';
import {track} from './shared';
import styles from './styles.module.css';

// "Talk to sales" goes to the same Webflow form as www.litellm.ai, so leads
// run through the same routing and Zap. When SALES_EMBED_URL is set, the form
// opens in a dialog on the docs page instead of a new tab.
export default function SalesButton({
  kind = 'sales',
  source = 'docs',
  variant = 'primary',
  children,
  className,
}) {
  const url = withUtm(kind === 'trial' ? TRIAL_URL : SALES_URL, source);
  const label = children || (kind === 'trial' ? 'Start a 30-day trial' : 'Talk to sales');
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const embed = kind === 'sales' && SALES_EMBED_URL;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const cls = clsx(variant === 'primary' ? styles.btnPrimary : styles.btnSecondary, className);
  const onClick = (e) => {
    track('docs_sales_cta_clicked', {kind, source, embedded: Boolean(embed)});
    if (embed) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <>
      <a className={cls} href={url} target="_blank" rel="noopener" onClick={onClick}>
        {label}
      </a>
      {embed && (
        <dialog ref={dialogRef} className={styles.dialog} onClose={() => setOpen(false)}>
          <button type="button" className={styles.dialogClose} onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
          {open && <iframe title="Talk to LiteLLM sales" src={withUtm(SALES_EMBED_URL, source)} className={styles.dialogFrame} />}
        </dialog>
      )}
    </>
  );
}
