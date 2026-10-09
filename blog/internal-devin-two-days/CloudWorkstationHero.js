import React, {useCallback, useEffect, useRef} from 'react';
import {useColorMode} from '@docusaurus/theme-common';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export default function CloudWorkstationHero({paused, setPaused}) {
  const frame = useRef(null);
  const {colorMode} = useColorMode();
  const source = useBaseUrl('/animations/internal-devin-two-days/index.html?embed=1');
  const updatePlayer = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      {type: 'moyai-hero', paused, theme: colorMode}, window.location.origin,
    );
  }, [paused, colorMode]);

  useEffect(updatePlayer, [updatePlayer]);

  return (
    <figure id="cloud-workstation-hero" className={styles.cloudHero}>
      <div className={styles.cloudStage}>
        <iframe
          ref={frame}
          className={styles.cloudFrame}
          src={source}
          title="Animated Moyai cloud workstation: our internal Devin, hosted on Render with Temporal sessions"
          onLoad={updatePlayer}
          scrolling="no"
        />
      </div>
      <figcaption>
        <span>Our internal Devin, running in the cloud.</span>
        <button className={styles.motionToggle} onClick={() => setPaused(!paused)}
          aria-pressed={paused}>{paused ? 'Play animation' : 'Pause animation'}</button>
      </figcaption>
    </figure>
  );
}
