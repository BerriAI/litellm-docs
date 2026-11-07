import React, {useEffect, useRef} from 'react';
import styles from './ConfigEditor.module.css';

// A dialog over the config pane: Escape or a click on the backdrop closes it, Tab stays inside it,
// and focus goes back where it was when it closes.

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

export default function ConfigModal({cap, title, sub, label, onClose, foot, children}) {
  const box = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const before = document.activeElement;
    box.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      } else if (event.key === 'Tab' && box.current) {
        const items = [...box.current.querySelectorAll(FOCUSABLE)].filter(item => item.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === box.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (before && document.contains(before)) before.focus?.();
    };
  }, []);

  return (
    <div className={styles.modalScrim} onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <div
        ref={box}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title}
        tabIndex={-1}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitles}>
            {cap && <span className={styles.cap}>{cap}</span>}
            <span className={styles.modalTitle}>{title}</span>
            {sub && <span className={styles.muted}>{sub}</span>}
          </div>
          <button type="button" className={styles.remove} aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {foot && <div className={styles.modalFoot}>{foot}</div>}
      </div>
    </div>
  );
}
