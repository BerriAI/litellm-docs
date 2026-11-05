import React, { useState } from "react";
import Link from "@docusaurus/Link";
import { PostByline } from "@theme/BlogPostPage";
import styles from "./launch.module.css";

const cases = [
  "Customer support",
  "Research assistant",
  "Document search",
  "Invoice extraction",
  "Weekly reports",
];
const phases = [
  { label: "New alert", remaining: [0, 1, 2, 3, 4] },
  { label: "Migrating", remaining: [0, 2] },
  { label: "Ready to resolve", remaining: [] },
];
const links = [
  ["See the alert", "#get-model-deprecation-alerts-in-the-litellm-ui"],
  ["Find the use cases", "#see-which-use-cases-need-to-move"],
  ["Choose a replacement", "#choose-a-replacement-model"],
  ["Set up emails", "#send-email-reminders"],
  ["Mark resolved", "#mark-the-alert-resolved"],
];

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

function LifecycleDial({ remaining, selected }) {
  return (
    <svg
      className={styles.lifecycleDial}
      viewBox="0 0 660 660"
      role="img"
      aria-label="Circular model lifecycle: provider notice, LiteLLM alert, migration, resolved."
    >
      <title>Model deprecation management in LiteLLM</title>
      <desc>
        {remaining.length
          ? `${remaining.length} use cases still need to move to a replacement model.`
          : "All five use cases have moved. Confirm the migration, then resolve the alert."}
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
            data-active={index === selected + 1}
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
        <rect x="-13" y="-112" width="26" height="26" rx="4" fill="white" />
        <image
          href="/img/model-deprecation-alerts/google.png"
          x="-9"
          y="-108"
          width="18"
          height="18"
        />
        <text y="-51" textAnchor="middle" className={styles.dialEyebrow}>
          MODEL LIFECYCLE
        </text>
        <text y="-8" textAnchor="middle" className={styles.dialTitle}>
          {["Deprecation", "Migration", "Ready to"][selected]}
        </text>
        <text y="31" textAnchor="middle" className={styles.dialTitle}>
          {["alert", "in progress", "resolve"][selected]}
        </text>
        <circle cx="-102" cy="76" r="3" fill="#ffd59b" />
        <text x="10" y="81" textAnchor="middle" className={styles.dialStatus}>
          {remaining.length} use cases to update
        </text>
      </g>
    </svg>
  );
}

function DeprecationHero() {
  const [selected, setSelected] = useState(0);
  const phase = phases[selected];
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
              <br className={styles.desktopBreak} /> for model deprecations.
            </p>
            <div
              className={styles.providerRow}
              role="group"
              aria-label="Model providers"
            >
              {providers.map((provider) => (
                <div key={provider.name} className={styles.provider}>
                  <span className={styles.providerLogo}>
                    <img
                      src={provider.logo}
                      alt={provider.name}
                      width="28"
                      height="28"
                    />
                  </span>
                  <span aria-hidden="true">{provider.name}</span>
                </div>
              ))}
            </div>
            <a
              className={styles.heroCta}
              href="#get-model-deprecation-alerts-in-the-litellm-ui"
            >
              See how it works <Arrow />
            </a>
          </div>
          <LifecycleDial remaining={phase.remaining} selected={selected} />
        </div>
        <div
          className={styles.useCaseProgress}
          role="status"
          aria-live="polite"
        >
          <div>
            <span>Use cases left to update</span>
            <strong>{phase.remaining.length}</strong>
          </div>
          <p>
            {phase.remaining.length
              ? phase.remaining.map((index) => cases[index]).join(" · ")
              : "All five use cases have moved. Confirm the migration, then mark the alert resolved."}
          </p>
        </div>
        <div className={styles.heroFoot}>
          <div
            className={styles.phaseControls}
            role="group"
            aria-label="Example migration stages"
          >
            {phases.map((item, index) => (
              <button
                key={item.label}
                type="button"
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                {item.label}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
          <span>ILLUSTRATIVE EXAMPLE / FIVE USE CASES</span>
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
      <nav className={styles.workflow} aria-label="Model deprecation workflow">
        {links.map(([label, href], index) => (
          <a href={href} key={href}>
            <span>0{index + 1}</span>
            {label}
            <span aria-hidden="true">↗</span>
          </a>
        ))}
      </nav>
      <div className={styles.article}>
        <div className={styles.byline}>
          <PostByline horizontal />
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
