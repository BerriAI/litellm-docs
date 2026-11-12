import React from 'react';
import {ONE_CLICK} from './content';
import {track} from './shared';
import styles from './styles.module.css';

// A small, self-contained block for hosted one-click deploys. The badges are
// the providers' own images, used as published.
export default function OneClickDeploy({source = 'docs'}) {
  return (
    <div className={styles.oneClick}>
      <div className={styles.oneClickCopy}>
        <p className={styles.oneClickTitle}>Cloud deployment options</p>
        <p className={styles.oneClickText}>
          Railway and Render host the same gateway and Postgres for you. For AWS and GCP, use the <a href="/docs/proxy/deploy/terraform">Terraform deployment guide</a>. Use your deployment's URL wherever this guide says <code>http://localhost:4000</code>.
        </p>
      </div>
      <div className={styles.oneClickBadges}>
        {ONE_CLICK.map(([name, url, badge]) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="nofollow noopener"
            onClick={() => track('docs_one_click_deploy', {provider: name, source})}>
            <img src={badge} alt={`Deploy on ${name}`} height="32" />
          </a>
        ))}
      </div>
    </div>
  );
}
