import React, {useEffect, useId, useRef, useState} from 'react';
import {COMPANY_SIZES, newSubmissionId, routeLead} from '@site/src/components/SalesForm/routing';
import {submitToWebflow} from '@site/src/components/SalesForm/webflow';
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
      const routed = routeLead({intent: 'talk-to-sales', size: values.companySize});
      const fields = buildWorkshopSubmission(values, {
        submissionId: submissionId.current,
        route: routed.route,
        reason: routed.reason,
      });
      await submitToWebflow(fields);
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
        <p className={styles.note}>Your request is saved. A session time has not been booked.</p>
        <button className={styles.submit} type="button" onClick={onClose}>Back to the workshop</button>
      </div> : <>
        <h2 className={styles.title} ref={heading} tabIndex={-1} id={`${id}-title`}>Build a self-hosted cloud agent.</h2>
        <p id={`${id}-description`} className={styles.description}>Tell us about your team and first workflow. We’ll follow up to arrange a 30-minute intake. Remote, over two weeks.</p>
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
              {field('companySize', 'Company size', <select defaultValue=""><option value="" disabled>Select company size</option>{COMPANY_SIZES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>, {required: true})}
              {field('workflow', 'What should your agent help your team do?', <textarea rows={3} placeholder="For example: take a Slack request, fix a bug, run tests, and open a PR." />, {required: true, wide: true})}
            </div>
            <details className={styles.details}>
              <summary>Your stack and on-site preferences <span>Optional</span></summary>
              <div className={styles.grid}>
                {field('harness', 'Agent or harness', <select defaultValue=""><option value="">No preference yet</option>{['Moyai', 'Claude Code', 'Codex', 'Hermes', 'OpenClaw', 'Pi', 'Other'].map(name => <option key={name}>{name}</option>)}</select>)}
                {field('location', 'Where is your team based?', <input type="text" placeholder="City, country, or time zone" />)}
                {field('providers', 'AI providers', <input type="text" placeholder="OpenAI, Anthropic, Bedrock…" />)}
                {field('sandbox', 'Sandbox and cloud', <input type="text" placeholder="Your sandbox or cloud preference" />)}
                {field('onsiteInterest', 'Interested in several days with our team at your office?', <select defaultValue=""><option value="">Select if you know</option><option value="Yes">Yes, let’s discuss an on-site build</option><option value="Maybe">Maybe, tell me more</option><option value="No">No, remote sessions work for us</option></select>, {wide: true})}
                {field('priorAttempts', 'What have you tried before?', <textarea rows={2} placeholder="What worked, and where you got stuck." />, {wide: true})}
                {field('litellmBlockers', 'Any other LiteLLM problems we can help with?', <textarea rows={2} placeholder="Deployment, routing, observability, or another blocker." />, {wide: true})}
              </div>
            </details>
            {error && <p className={styles.error} ref={errorMessage} tabIndex={-1} role="alert">{error}</p>}
            <button className={styles.submit} type="submit" disabled={status === 'sending'}>{status === 'sending' ? 'Saving your request…' : 'Sign up'}</button>
            <p className={styles.note}>* Required. We’ll use your details to arrange your workshop intake. Submitting this form does not reserve a time slot.</p>
          </fieldset>
        </form>
      </>}
    </div>
  </dialog>;
}
