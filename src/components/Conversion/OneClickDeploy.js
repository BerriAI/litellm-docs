import React from 'react';
import {ONE_CLICK} from './content';
import {track} from './shared';
import styles from './styles.module.css';

export default function OneClickDeploy({source = 'docs'}) {
  return (
    <div className={styles.oneClick}>
      <div className={styles.oneClickCopy}>
        <p className={styles.oneClickTitle}>Cloud deployment options</p>
        <p className={styles.oneClickText}>
          Deploy the gateway and Postgres on Railway or Render, or use <a href="/docs/proxy/deploy/terraform">Terraform for AWS and GCP</a>. Replace <code>http://localhost:4000</code> with your deployment's URL.
        </p>
        <p className={styles.oneClickText}>
          Render: set <strong>Blueprint Path</strong> to <code>litellm/deploy/render/render.yaml</code> before you deploy.
        </p>
      </div>
      <div className={styles.oneClickBadges}>
        {ONE_CLICK.map(([name, url]) => (
          <a
            className={styles.btnPrimary}
            key={name}
            href={url}
            target="_blank"
            rel="nofollow noopener"
            onClick={() => track('docs_one_click_deploy', {provider: name, source})}>
            Deploy {name === 'Render' ? 'to' : 'on'} {name}
          </a>
        ))}
      </div>
    </div>
  );
}
