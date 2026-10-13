import React, {useEffect, useId, useRef, useState} from 'react';
import {newSubmissionId} from '@site/src/components/SalesForm/routing';
import {submitWorkshopSignup} from './signup-client.mjs';
import {FIELD_LIMITS, buildWorkshopSubmission, normalizeWorkshopValues, validateWorkshopValues} from './signup-payload.mjs';
import styles from './signup.module.css';

function Field({id, name, label, required = false, wide = false, errors, children}) {
  const fieldId = `${id}-${name}`;
  return <label className={`${styles.field} ${wide ? styles.wide : ''}`} htmlFor={fieldId}>
    <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
    {React.cloneElement(children, {
      id: fieldId,
      name,
      required,
      ...(children.type !== 'select' ? {maxLength: FIELD_LIMITS[name]} : {}),
      'aria-invalid': errors[name] ? true : undefined,
      'aria-describedby': errors[name] ? `${fieldId}-error` : undefined,
    })}
    {errors[name] && <span id={`${fieldId}-error`} className={styles.fieldError}>{errors[name]}</span>}
  </label>;
}

export default function SignupDialog({open, onClose}) {
  const id = useId();
  const dialog = useRef(null);
  const heading = useRef(null);
  const errorMessage = useRef(null);
  const inFlight = useRef(false);
  const submissionId = useRef(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [email, setEmail] = useState('');

  useEffect(() => {
    const element = dialog.current;
    if (open && !element.open) {
      element.showModal();
      if (status === 'success') heading.current?.focus();
      else element.querySelector('[name="name"]')?.focus();
    } else if (!open && element.open) element.close();
  }, [open, status]);

  useEffect(() => {
    if (status === 'success' && open) heading.current?.focus();
  }, [status, open]);

  useEffect(() => {
    if (error) errorMessage.current?.focus();
  }, [error]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (inFlight.current || status === 'success') return;
    const form = event.currentTarget;
    const values = normalizeWorkshopValues(Object.fromEntries(new FormData(form).entries()));
    const validation = validateWorkshopValues(values);
    setErrors(validation);
    setError('');
    if (Object.keys(validation).length) {
      form.elements.namedItem(Object.keys(validation)[0])?.focus();
      return;
    }

    inFlight.current = true;
    setStatus('sending');
    submissionId.current ||= newSubmissionId();
    try {
      const fields = buildWorkshopSubmission(values, {
        submissionId: submissionId.current,
        source: window.location.href,
      });
      await submitWorkshopSignup(fields);
      setEmail(values.email);
      setStatus('success');
    } catch {
      setStatus('idle');
      setError('We couldn’t confirm your request. Your answers are still here. Please try again.');
    } finally {
      inFlight.current = false;
    }
  }

  const field = (name, label, child, options = {}) => <Field id={id} name={name} label={label} errors={errors} {...options}>{child}</Field>;

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onClose={onClose} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <div className={styles.panel}>
      <button className={styles.close} type="button" onClick={onClose} aria-label="Close workshop signup">×</button>
      <p className={styles.eyebrow}>LITELLM WORKSHOP · OCTOBER 19–30</p>
      {status === 'success' ? <div className={styles.success}>
        <h2 className={styles.title} ref={heading} tabIndex={-1} id={`${id}-title`}>Workshop request received.</h2>
        <p id={`${id}-description`}>The LiteLLM team will follow up at <strong>{email}</strong> to arrange your 30-minute intake and discuss what you want to build.</p>
        <p className={styles.note}>Your request was received. A session time has not been booked.</p>
        <button className={styles.submit} type="button" onClick={onClose}>Back to the workshop</button>
      </div> : <>
        <h2 className={styles.title} ref={heading} tabIndex={-1} id={`${id}-title`}>Build a self-hosted cloud agent.</h2>
        <p id={`${id}-description`} className={styles.description}>Tell us about your team and what you want to achieve. We’ll follow up to arrange a 30-minute intake. Remote, over two weeks.</p>
        <form onSubmit={handleSubmit} aria-busy={status === 'sending'} onInput={() => {
          if (error) setError('');
          if (Object.keys(errors).length) setErrors({});
        }}>
          <fieldset className={styles.fieldset} disabled={status === 'sending'}>
            <legend className={styles.srOnly}>Workshop signup details</legend>
            <div className={styles.grid}>
              {field('name', 'Your name', <input type="text" autoComplete="name" />, {required: true})}
              {field('email', 'Work email', <input type="email" autoComplete="email" />, {required: true})}
              {field('company', 'Company', <input type="text" autoComplete="organization" />, {required: true})}
              {field('linkedin', 'LinkedIn profile', <input type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} placeholder="linkedin.com/in/your-profile" />, {required: true})}
              {field('workflow', 'What are you hoping to achieve?', <textarea rows={3} placeholder="For example: let engineers send tasks in Slack and get tested pull requests from an agent running in our cloud." />, {required: true, wide: true})}
              {field('onsiteInterest', 'Would you like the LiteLLM team to work with you on-site? (optional)', <select defaultValue=""><option value="">No preference yet</option><option value="Yes">Yes, I’d like to discuss it</option><option value="Maybe">Maybe, tell me more</option><option value="No">No, remote works for us</option></select>, {wide: true})}
            </div>
            {error && <p className={styles.error} ref={errorMessage} tabIndex={-1} role="alert">{error}</p>}
            <button className={styles.submit} type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Saving your request…' : 'Sign up'}</button>
            <p className={styles.note}>* Required. We’ll use your details to arrange your workshop intake. Submitting this form does not reserve a time slot.</p>
          </fieldset>
        </form>
      </>}
    </div>
  </dialog>;
}
