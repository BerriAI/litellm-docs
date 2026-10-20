import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useColorMode} from '@docusaurus/theme-common';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {ArrowRight, Network, Pause, Play, Terminal} from 'lucide-react';
import styles from './styles.module.css';

const root = '/docs/self_hosted_coding_agents/moyai';

export function GuideNav({active}) {
  return (
    <nav className={styles.nav} aria-label="Moyai guides">
      {[
        ['overview', '', 'Moyai'],
        ['setup', '/setup', 'Setup'],
        ['architecture', '/architecture', 'Architecture'],
      ].map(([id, path, label]) => (
        <Link key={id} to={`${root}${path}`} aria-current={active === id ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function MoyaiHero() {
  const frame = useRef(null);
  const figure = useRef(null);
  const [paused, setPaused] = useState(true);
  const [visible, setVisible] = useState(true);
  const {colorMode} = useColorMode();
  const source = useBaseUrl('/animations/moyai-landing/?embed=1');
  const updatePlayer = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      {type: 'moyai-landing-hero', paused, visible, theme: colorMode}, window.location.origin,
    );
  }, [paused, visible, colorMode]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPreference = () => setPaused(preference.matches);
    applyPreference();
    preference.addEventListener('change', applyPreference);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(figure.current);
    return () => {
      preference.removeEventListener('change', applyPreference);
      observer.disconnect();
    };
  }, []);
  useEffect(updatePlayer, [updatePlayer]);

  return (
    <header className={styles.hero}>
      <h1>Moyai</h1>
      <p className={styles.tagline}>Give your coding agents a cloud workspace.</p>
      <figure ref={figure} className={styles.workflow}>
        <iframe
          ref={frame}
          className={styles.heroFrame}
          src={source}
          title="Illustrated Moyai workflow: give a task through Slack or Web, run it in Moyai’s cloud workspace with inference through LiteLLM, and come back to a pull request."
          onLoad={updatePlayer}
          scrolling="no"
        />
        <figcaption className={styles.heroCaption}>
          <span>From a task to a pull request, in your cloud.</span>
          <button type="button" className={styles.motionToggle} onClick={() => setPaused(value => !value)} aria-pressed={paused}>
            {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
            {paused ? 'Play animation' : 'Pause animation'}
          </button>
        </figcaption>
      </figure>
    </header>
  );
}

export function BenefitGrid() {
  return (
    <div className={styles.benefits}>
      <section aria-labelledby="cost-comparison">
        <span className={styles.number}>01</span>
        <Heading as="h3" id="cost-comparison">Spend less on coding agents</Heading>
        <p>Our Devin bill reached <strong>$101,872 in 31 days</strong>. We estimate Moyai at <strong>~$21,700 for the same period</strong>, about <strong>79% less</strong>. You choose where to spend on models and cloud compute.</p>
        <p className={styles.estimateNote}>Our team's estimate, not a matched-workload benchmark. Your costs depend on usage, models, hosting, and storage.</p>
        <Link className={styles.proofLink} to="/blog/moyai-open-source#the-results-79-cheaper">Read our cost breakdown <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
      <section aria-labelledby="delegate-cloud-work">
        <span className={styles.number}>02</span>
        <Heading as="h3" id="delegate-cloud-work">Close your laptop. Come back to a PR.</Heading>
        <p>Send a task from Slack or the browser. Moyai works in a cloud sandbox, edits code, and runs tests while you're away. Review the diff and test results when you return.</p>
        <Link className={styles.proofLink} to="#watch-a-task">Watch a real bug fix <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
      <section aria-labelledby="budget-your-agents">
        <span className={styles.number}>03</span>
        <Heading as="h3" id="budget-your-agents">One source of truth for model costs</Heading>
        <p>Use LiteLLM as your source of truth for model charges. In Moyai, see those same charges by user, session, and model. Trace a teammate's total back to the requests behind it.</p>
        <Link className={styles.proofLink} to="#see-agent-spend">See the spend breakdown <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
      <section aria-labelledby="choose-your-stack">
        <span className={styles.number}>04</span>
        <Heading as="h3" id="choose-your-stack">Choose your agent and model</Heading>
        <p>Run Codex, Claude Agent SDK, or Hermes with a compatible model through your LiteLLM gateway. Try a different model for the next task and compare the result and cost.</p>
        <Link className={styles.proofLink} to={`${root}/setup#configure-litellm`}>Explore supported agents <ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}

export function GuideCards() {
  return (
    <nav className={styles.guides} aria-label="Moyai guides">
      <Link to={`${root}/setup`} className={styles.guideCard}>
        <Terminal size={26} aria-hidden="true" />
        <div><h3>Setup</h3><p>Deploy Moyai. Run your first cloud task.</p></div>
        <ArrowRight className={styles.guideArrow} size={22} aria-hidden="true" />
      </Link>
      <Link to={`${root}/architecture`} className={styles.guideCard}>
        <Network size={26} aria-hidden="true" />
        <div><h3>Architecture</h3><p>Explore sandboxes, checkpoints, and recovery.</p></div>
        <ArrowRight className={styles.guideArrow} size={22} aria-hidden="true" />
      </Link>
    </nav>
  );
}

export function SetupCallout() {
  return (
    <section className={styles.setupCallout} aria-labelledby="try-moyai">
      <div>
        <Heading as="h2" id="try-moyai">Run your first cloud task.</Heading>
        <p>Connect your gateway, verify a task, then give Moyai a small repository change. Review the work and its cost before rolling it out to your team.</p>
      </div>
      <Link className={styles.setupButton} to={`${root}/setup`}>Set up Moyai <ArrowRight size={18} aria-hidden="true" /></Link>
    </section>
  );
}
