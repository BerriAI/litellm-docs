// Sizes derived from the published 65.6 MB / 32.2% source-build comparison in this post
import React from 'react';
import styles from './hero.module.css';

const BASELINE_MB = 203.7;
const CORE_MB = 138.1;
const BAR_X = 320;
const BAR_MAX = 810;
const coreWidth = Math.round((CORE_MB / BASELINE_MB) * BAR_MAX);

const description = `Installed size including runtime dependencies: litellm is about ${Math.round(BASELINE_MB)} MB and litellm-core is about ${Math.round(CORE_MB)} MB, 65.6 MB (32.2%) smaller.`;

export default function CoreHero() {
  return (
    <div className={styles.hero}>
      <svg viewBox="0 0 1200 600" width="100%" height="100%" role="img" aria-label={description}>
        <text x="70" y="118" className={styles.metric}>65.6 MB smaller install</text>
        <text x="72" y="168" className={styles.caption}>
          Installed size of a default install, including runtime dependencies
        </text>

        <text x="70" y="301" className={styles.label}>litellm</text>
        <rect x={BAR_X} y="256" width={BAR_MAX} height="68" rx="10" className={styles.baseline} />
        <text x={BAR_X + BAR_MAX - 24} y="301" textAnchor="end" className={styles.baselineValue}>
          about {Math.round(BASELINE_MB)} MB
        </text>

        <text x="70" y="425" className={styles.label}>litellm-core</text>
        <rect x={BAR_X} y="380" width={coreWidth} height="68" rx="10" className={styles.core} />
        <text x={BAR_X + coreWidth - 24} y="425" textAnchor="end" className={styles.coreValue}>
          about {Math.round(CORE_MB)} MB
        </text>
        <rect
          x={BAR_X + coreWidth + 8}
          y="381"
          width={BAR_MAX - coreWidth - 9}
          height="66"
          rx="10"
          className={styles.saved}
        />
        <text x={BAR_X + coreWidth + 8 + (BAR_MAX - coreWidth - 8) / 2} y="425" textAnchor="middle" className={styles.savedValue}>
          -65.6 MB (32.2%)
        </text>

        <text x="72" y="540" className={styles.footnote}>
          boto3, tokenizers, and huggingface-hub are now optional. Your code still uses import litellm
        </text>
      </svg>
    </div>
  );
}
