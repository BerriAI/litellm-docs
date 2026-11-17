import React, {createContext, useCallback, useContext, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {track} from '../Conversion/shared';
import {submitToWebflow} from './webflow';
import {
  COMPANY_SIZES,
  ENTERPRISE_SIZE,
  INTENTS,
  calendlyUrl,
  meetsSales,
  newSubmissionId,
  routeLead,
  successCopy,
} from './routing';
import styles from './styles.module.css';

// The website's Enterprise request form as a dialog on the docs, so a reader
// never leaves the page to reach sales. Same fields, same routing, same
// Webflow form (and so the same Zap), and the same Calendly step for leads
// routed to a call. The button that opened it sets the intent.

const SalesFormContext = createContext({open: () => {}});

export function useSalesForm() {
  return useContext(SalesFormContext);
}

// Plain links to the website form, in Markdown or components, open the
// dialog too. Modified clicks still open the website in a new tab.
const FORM_LINK = /^https?:\/\/(www\.)?litellm\.ai\/enterprise\/?(\?[^#]*)?#(talk-to-sales|trial)$/;

function emit(event, props) {
  track(`enterprise_form_${event}`, {form_location: 'docs', ...props});
}

export function SalesFormProvider({children}) {
  const [request, setRequest] = useState(null);
  const open = useCallback((opts = {}) => {
    setRequest({intent: opts.intent === '30-day-trial' ? '30-day-trial' : 'talk-to-sales', source: opts.source || 'docs', key: Date.now()});
  }, []);
  const close = useCallback(() => setRequest(null), []);

  useEffect(() => {
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest?.('a[href]');
      if (!a || !FORM_LINK.test(a.href)) return;
      e.preventDefault();
      const hash = a.href.split('#')[1];
      open({intent: hash === 'trial' ? '30-day-trial' : 'talk-to-sales', source: `link:${window.location.pathname}`});
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [open]);

  return (
    <SalesFormContext.Provider value={{open}}>
      {children}
      <SalesFormDialog request={request} onClose={close} />
    </SalesFormContext.Provider>
  );
}

function SalesFormDialog({request, onClose}) {
  const ref = useRef(null);
  const isOpen = Boolean(request);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) {
      d.showModal();
      // showModal focuses the close button, the first control; start on Name
      d.querySelector('[name="first-name"]')?.focus();
    }
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  // A click on the backdrop lands on the <dialog> itself
  const onDialogClick = (e) => {
    if (e.target === ref.current) onClose();
  };

  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} onClick={onDialogClick} aria-labelledby="sf-title">
      {request && <SalesFormBody key={request.key} request={request} onClose={onClose} />}
    </dialog>
  );
}

function SalesFormBody({request, onClose}) {
  const [intent, setIntent] = useState(request.intent);
  const [size, setSize] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | failed
  const [result, setResult] = useState(null);
  const started = useRef(false);
  const submissionId = useRef(null);
  const who = useRef({});

  useEffect(() => {
    emit('viewed', {intent_preselected: request.intent, source: request.source});
  }, [request]);

  const onInput = () => {
    setError('');
    if (!started.current) {
      started.current = true;
      emit('started', {intent, source: request.source});
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const bad = form.querySelector(':invalid');
    if (bad) {
      const label = bad.closest('label')?.querySelector('[data-label]')?.textContent || 'This field';
      const typo = bad.type === 'email' && bad.value;
      setError(typo ? 'Enter a valid work email.' : `${label} is required.`);
      emit('error', {field: bad.name, step: 1});
      bad.focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    const routed = routeLead({intent, size: data['company-size']});
    submissionId.current = submissionId.current || newSubmissionId();
    who.current = {name: data['first-name'], email: data.email, submissionId: submissionId.current};
    const fields = {
      ...data,
      intent,
      'submission-id': submissionId.current,
      'lead-route': routed.route,
      'lead-routing-reason': routed.reason,
    };
    const props = {intent, route: routed.route, company_size: data['company-size'], submission_id: submissionId.current, source: request.source};

    setStatus('sending');
    emit('submitted', props);
    try {
      await submitToWebflow(fields);
      setResult(routed);
      setStatus('done');
      track('enterprise_request_accepted', {form_location: 'docs', ...props});
    } catch (err) {
      setStatus('failed');
      emit('failed', {...props, message: String(err?.message || err)});
    }
  };

  const close = (
    <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );

  if (status === 'done' && result) {
    const thanks = successCopy(result);
    return (
      <div className={clsx(styles.body, meetsSales(result) && styles.bodyWide)}>
        {close}
        <h2 id="sf-title" className={styles.title}>{thanks.heading}</h2>
        <p className={styles.lead}>{thanks.body}</p>
        {meetsSales(result) && (
          <iframe
            className={styles.calendar}
            src={calendlyUrl(result, who.current)}
            title={`Schedule with the LiteLLM ${result.route} team`}
          />
        )}
      </div>
    );
  }

  const copy = INTENTS[intent];
  const big = size === ENTERPRISE_SIZE;
  const switchIntent = () => {
    setIntent(copy.switchTo);
    emit('intent_switched', {from: intent, to: copy.switchTo, source: request.source});
  };

  return (
    <div className={styles.body}>
      {close}
      <h2 id="sf-title" className={styles.title}>{copy.title}</h2>
      <p className={styles.lead}>
        {copy.lead}{' '}
        <button type="button" className={styles.switch} onClick={switchIntent}>
          {copy.switchLabel}
        </button>
      </p>

      <form className={styles.form} onSubmit={onSubmit} onInput={onInput} noValidate>
        <div className={styles.grid}>
          <Field label="Name">
            <input className={styles.input} type="text" name="first-name" autoComplete="name" required />
          </Field>
          <Field label="Work email">
            <input className={styles.input} type="email" name="email" autoComplete="email" required />
          </Field>
          <Field label="Company">
            <input className={styles.input} type="text" name="company-name" autoComplete="organization" required />
          </Field>
          <Field label="Company size">
            <select
              className={styles.input}
              name="company-size"
              required
              value={size}
              onChange={(e) => setSize(e.target.value)}
            >
              <option value="" disabled>
                Select one
              </option>
              {COMPANY_SIZES.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          </Field>
          {big && (
            <>
              <Field label="What are you hoping to learn about LiteLLM today?" optional wide>
                <input className={styles.input} type="text" name="hoping-to-learn" />
              </Field>
              <Field label="Phone number (for text updates)" optional wide>
                <input className={styles.input} type="tel" name="phone" autoComplete="tel" inputMode="tel" />
              </Field>
              <Field label="Anything else we should know?" optional wide>
                <textarea className={styles.input} name="notes" rows={3} />
              </Field>
            </>
          )}
        </div>

        <div className={styles.error} aria-live="polite">
          {status === 'failed' ? (
            <>
              That did not go through. Try again, or use the{' '}
              <a href="https://www.litellm.ai/enterprise#talk-to-sales" target="_blank" rel="noopener">
                form on litellm.ai
              </a>
              .
            </>
          ) : (
            error
          )}
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.submit} disabled={status === 'sending'}>
            {status === 'sending' ? 'Please wait...' : copy.submit}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({label, optional, wide, children}) {
  return (
    <label className={clsx(styles.field, wide && styles.fieldWide)}>
      <span className={styles.label}>
        <span data-label>{label}</span>
        {!optional && <span aria-hidden="true"> *</span>}
      </span>
      {children}
    </label>
  );
}
