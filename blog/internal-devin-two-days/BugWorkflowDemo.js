import React from 'react';
import recording from './bug-workflow.mp4';
import poster from './bug-workflow-poster.jpg';
import styles from './BugWorkflowDemo.module.css';

export default function BugWorkflowDemo() {
  const posterUrl = typeof poster === 'string' ? poster : poster.src.src;

  return (
    <figure className={styles.demo}>
      <div className={styles.layout}>
        <div className={styles.context}>
          <span className={styles.label}>A real /team workflow</span>
          <h3>From a Slack bug to a pull request.</h3>
          <p>
            A teammate spotted broken mentions. I asked Moyai to run{' '}
            <code>/personal:team</code>. It traced the escaping bug, added a
            regression test, and opened the fix.
          </p>
          <span className={styles.outcome}>61 Slack tests passed</span>
        </div>
        <video
          className={styles.video}
          controls
          muted
          playsInline
          preload="none"
          src={recording}
          poster={posterUrl}
          width="780"
          height="504"
          aria-label="24-second walkthrough of Moyai's real cloud session: a team workflow request, root cause investigation, pull request, and regression tests"
        >
          <a href={recording}>Watch the bug-fix walkthrough</a>
        </video>
      </div>
      <figcaption className={styles.caption}>
        24-second walkthrough of the completed cloud session. The fix was tested
        with a mocked Slack transport.
      </figcaption>
    </figure>
  );
}
