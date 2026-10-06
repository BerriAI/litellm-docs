import React from 'react';
import recording from './bug-workflow.mp4';
import poster from './bug-workflow-poster.jpg';
import styles from './BugWorkflowDemo.module.css';

export default function BugWorkflowDemo() {
  const posterUrl = typeof poster === 'string'
    ? poster
    : poster.src.images.find((image) => image.width >= 1280)?.path ?? poster.src.src;

  return (
    <figure className={styles.demo}>
      <video
        className={styles.video}
        controls
        muted
        playsInline
        preload="none"
        src={recording}
        poster={posterUrl}
        width="1600"
        height="1000"
        aria-label="18-second walkthrough of Moyai across Slack and the web: a real team workflow request, investigation, regression tests, and a pull request returned to the thread"
      >
        <a href={recording}>Watch the bug-fix walkthrough</a>
      </video>
      <figcaption className={styles.caption}>
        A real <code>/personal:team</code> bug fix across Slack and the web.
        Edited 18-second walkthrough of a completed session; tests used a mocked
        Slack transport.
      </figcaption>
    </figure>
  );
}
