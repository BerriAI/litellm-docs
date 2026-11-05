import React from "react";
import Link from "@docusaurus/Link";
import { PostByline } from "@theme/BlogPostPage";
import styles from "./launch.module.css";

function Arrow() {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M10 90 90 10M37 10h53v53" />
    </svg>
  );
}

const providers = [
  { name: "OpenAI", logo: "/img/providers/openai_small.svg" },
  { name: "Anthropic", logo: "/img/providers/anthropic.svg" },
  { name: "Google", logo: "/img/model-deprecation-alerts/google.png" },
  { name: "Azure", logo: "/img/integrations/azure.svg" },
  { name: "AWS", logo: "/img/cloud_icons/aws.svg" },
];
const dialStages = [
  {
    title: "PROVIDER NOTICE",
    detail: "A model is retiring",
    start: -133,
    end: -48,
    x: 0,
    y: -232,
    rotation: 0,
  },
  {
    title: "UI ALERT",
    detail: "Find affected keys",
    start: -42,
    end: 42,
    x: 231,
    y: 0,
    rotation: 90,
  },
  {
    title: "MIGRATE",
    detail: "Move use cases",
    start: 48,
    end: 132,
    x: 0,
    y: 231,
    rotation: 0,
  },
  {
    title: "RESOLVED",
    detail: "Confirm zero traffic",
    start: 138,
    end: 222,
    x: -231,
    y: 0,
    rotation: -90,
  },
];

function dialPoint(radius, degrees) {
  const angle = (degrees * Math.PI) / 180;
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

function dialArc(radius, start, end) {
  const [x1, y1] = dialPoint(radius, start);
  const [x2, y2] = dialPoint(radius, end);
  return `M${x1},${y1} A${radius},${radius} 0 0 1 ${x2},${y2}`;
}

function LifecycleDial() {
  return (
    <svg
      className={styles.lifecycleDial}
      viewBox="0 0 660 660"
      role="img"
      aria-label="Circular model lifecycle: provider notice, LiteLLM alert, migration, resolved."
    >
      <title>Model deprecation management in LiteLLM</title>
      <desc>
        Provider deprecation notice, an alert in the LiteLLM UI, migration, and
        resolution. Model providers: OpenAI, Anthropic, Google, Azure, and AWS.
      </desc>
      <g transform="translate(330 330)">
        {[158, 165, 176, 290, 302, 312].map((radius) => (
          <circle key={radius} r={radius} className={styles.dialGuide} />
        ))}
        {Array.from({ length: 120 }, (_, index) => {
          const [x1, y1] = dialPoint(index % 5 === 0 ? 301 : 306, index * 3);
          const [x2, y2] = dialPoint(312, index * 3);
          return (
            <path
              key={index}
              d={`M${x1},${y1} L${x2},${y2}`}
              className={styles.dialTick}
            />
          );
        })}
        {dialStages.map((stage, index) => (
          <g
            key={stage.title}
            className={styles.dialSector}
            data-active={index === 1}
          >
            {Array.from({ length: 19 }, (_, ring) => (
              <path
                key={ring}
                d={dialArc(190 + ring * 4.55, stage.start, stage.end)}
                className={styles.dialEngraving}
              />
            ))}
          </g>
        ))}
        {[-135, -45, 45, 135].map((angle) => {
          const [x1, y1] = dialPoint(174, angle);
          const [x2, y2] = dialPoint(298, angle);
          return (
            <path
              key={angle}
              d={`M${x1},${y1} L${x2},${y2}`}
              className={styles.dialDivider}
            />
          );
        })}
        {[-90, 0, 90, 180].map((angle) => {
          const [x, y] = dialPoint(285, angle);
          return (
            <path
              key={angle}
              d="M-5-5 0 0-5 5"
              transform={`translate(${x} ${y}) rotate(${angle + 90})`}
              className={styles.dialArrow}
            />
          );
        })}
        {dialStages.map((stage) => (
          <g
            key={stage.title}
            transform={`translate(${stage.x} ${stage.y}) rotate(${stage.rotation})`}
          >
            <rect
              x="-81"
              y="-24"
              width="162"
              height="61"
              className={styles.dialLabelBackdrop}
            />
            <text textAnchor="middle" className={styles.dialLegendTitle}>
              {stage.title}
            </text>
            <text
              y="22"
              textAnchor="middle"
              className={styles.dialLegendDetail}
            >
              {stage.detail}
            </text>
          </g>
        ))}
        <g transform="translate(0 -102)" aria-label="Model providers">
          {providers.map((provider, index) => (
            <g
              key={provider.name}
              transform={`translate(${(index - 2) * 40} 0)`}
            >
              <title>{provider.name}</title>
              <circle r="18" fill="white" />
              <image
                href={provider.logo}
                x="-14"
                y="-14"
                width="28"
                height="28"
              />
            </g>
          ))}
        </g>
        <text y="-51" textAnchor="middle" className={styles.dialEyebrow}>
          MODEL LIFECYCLE
        </text>
        <text y="-8" textAnchor="middle" className={styles.dialTitle}>
          Deprecation
        </text>
        <text y="31" textAnchor="middle" className={styles.dialTitle}>
          alert
        </text>
        <circle cx="-102" cy="76" r="3" fill="#ffd59b" />
        <text x="10" y="81" textAnchor="middle" className={styles.dialStatus}>
          Review affected keys
        </text>
      </g>
    </svg>
  );
}

function DeprecationHero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroNav}>
          <div className={styles.brand}>
            <img
              src="/img/brand/litellm-logo-white.png"
              alt="LiteLLM"
              width="150"
              height="36"
            />
            <span>/ AI GATEWAY</span>
          </div>
          <Link to="/blog">
            Back to the blog <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div className={styles.heroBody}>
          <div className={styles.heroCopy}>
            <p className={styles.heroMeta}>
              MODEL LIFECYCLE MANAGEMENT / NEW IN THE LITELLM UI
            </p>
            <h1 className={styles.heroTitle}>
              <span>Model</span>
              <span>Deprecation</span>
              <span>Management</span>
            </h1>
            <p className={styles.heroIntro}>
              The LiteLLM UI now has alerts
              <br /> for model deprecations.
            </p>
            <a
              className={styles.heroCta}
              href="#alerts-around-model-deprecations"
            >
              See how it works <Arrow />
            </a>
          </div>
          <LifecycleDial />
        </div>
      </div>
    </header>
  );
}

export function ProductScreenshot({ src, alt, children }) {
  return (
    <figure className={styles.screenshot}>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={"Open full-size screenshot: " + alt}
      >
        <img src={src} alt={alt} loading="lazy" />
      </a>
      <figcaption>{children}</figcaption>
    </figure>
  );
}

export default function DeprecationPage({ children }) {
  return (
    <div className={styles.root} data-full-width>
      <DeprecationHero />
      <div className={styles.article}>
        <div className={styles.byline}>
          <PostByline horizontal />
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
