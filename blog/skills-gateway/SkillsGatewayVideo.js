import React from 'react';
import video from './skills-gateway.mp4';
import poster from './video-poster.png';
import styles from './styles.module.css';

export default function SkillsGatewayVideo() {
  const posterUrl = typeof poster === 'string'
    ? poster
    : poster.src.images.find((image) => image.width >= 1280)?.path ?? poster.src.src;

  return (
    <figure className={styles.figure}>
      <video
        className={styles.video}
        controls
        muted
        playsInline
        preload="none"
        src={video}
        poster={posterUrl}
        width="1920"
        height="1080"
        aria-label="Skills Gateway overview: upload a skill ZIP, review submissions, and inspect download history"
      >
        <a href={video}>Watch the Skills Gateway overview</a>
      </video>
      <figcaption className={styles.caption}>
        A silent, 20-second overview of ZIP uploads, admin review, and download history.
      </figcaption>
    </figure>
  );
}
