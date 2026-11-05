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

function LifecycleCircle({ remaining, selected, mobile = false }) {
  const center = mobile ? [200, 250] : [620, 247];
  const radius = mobile ? 132 : 174;
  const offset = radius / Math.sqrt(2);
  const stages = [
    {
      title: "Provider deprecates a model",
      detail: "A deprecation date is announced.",
      x: -offset,
      y: -offset,
    },
    {
      title: "LiteLLM alerts you",
      detail: "Find the keys that depend on it.",
      x: offset,
      y: -offset,
    },
    {
      title: "Move your use cases",
      detail: "Track traffic to the old model.",
      x: offset,
      y: offset,
    },
    {
      title: "Confirm and resolve",
      detail: "Check traffic has reached zero.",
      x: -offset,
      y: offset,
    },
  ];
  return (
    <svg
      className={mobile ? styles.mobileCircle : styles.desktopCircle}
      viewBox={mobile ? "0 0 400 510" : "0 0 1240 494"}
      role="img"
      aria-label="Model lifecycle: a provider retires a model, LiteLLM alerts you, you migrate affected use cases, then resolve the alert."
    >
      <title>Model deprecation management in LiteLLM</title>
      <desc>
        {remaining.length
          ? remaining.length +
            " use cases still need to move to a replacement model."
          : "All five use cases have moved. Confirm the migration, then resolve the alert."}
      </desc>
      <g transform={"translate(" + center.join(" ") + ")"}>
        <circle r={radius + 22} className={styles.circleGuide} />
        <circle
          r={radius - 21}
          className={styles.circleGuide}
          strokeDasharray="1 7"
        />
        <circle r={radius} className={styles.circleTrack} />
        {[-90, 0, 90, 180].map((angle) => (
          <g key={angle} transform={"rotate(" + angle + ")"}>
            <path
              d={
                "M" +
                (radius - 5) +
                " -6 " +
                radius +
                " 0 " +
                (radius + 5) +
                " -6"
              }
              className={styles.circleArrow}
            />
          </g>
        ))}
        {stages.map((stage, index) => {
          const right = stage.x > 0;
          const bottom = stage.y > 0;
          const textX = mobile ? (right ? 108 : -108) : right ? 254 : -254;
          const textY = mobile ? (bottom ? 204 : -173) : bottom ? 123 : -119;
          const anchor = mobile ? "middle" : right ? "start" : "end";
          const current = index === selected + 1;
          return (
            <g
              key={stage.title}
              className={styles.circleStage}
              data-active={current}
            >
              <path
                d={
                  mobile
                    ? "M" +
                      stage.x +
                      " " +
                      stage.y +
                      "V" +
                      (bottom ? 170 : -146)
                    : "M" + stage.x + " " + stage.y + "H" + (right ? 231 : -231)
                }
                className={styles.circleLeader}
              />
              <circle
                cx={stage.x}
                cy={stage.y}
                r={current ? 7 : 4}
                fill="white"
              />
              {current && (
                <circle
                  cx={stage.x}
                  cy={stage.y}
                  r="13"
                  className={styles.circleHalo}
                />
              )}
              <text
                x={textX}
                y={textY}
                textAnchor={anchor}
                className={styles.circleStageTitle}
              >
                {mobile ? (
                  <>
                    <tspan x={textX}>
                      {
                        ["Provider", "LiteLLM", "Move your", "Confirm and"][
                          index
                        ]
                      }
                    </tspan>
                    <tspan x={textX} dy="20">
                      {
                        [
                          "deprecates a model",
                          "alerts you",
                          "use cases",
                          "resolve",
                        ][index]
                      }
                    </tspan>
                  </>
                ) : (
                  stage.title
                )}
              </text>
              {!mobile && (
                <text
                  x={textX}
                  y={textY + 26}
                  textAnchor={anchor}
                  className={styles.circleStageDetail}
                >
                  {stage.detail}
                </text>
              )}
            </g>
          );
        })}
        <text y="-75" textAnchor="middle" className={styles.circleEyebrow}>
          LITELLM UI / ALERTS
        </text>
        <text y="-38" textAnchor="middle" className={styles.circleTitle}>
          Model deprecation
        </text>
        <rect x="-101" y="-17" width="20" height="20" rx="3" fill="white" />
        <image
          href="/img/model-deprecation-alerts/google.png"
          x="-98"
          y="-14"
          width="14"
          height="14"
        />
        <text x="13" y="-2" textAnchor="middle" className={styles.circleModel}>
          gemini/gemini-2.5-pro
        </text>
        <text y="57" textAnchor="middle" className={styles.circleCount}>
          {remaining.length}
        </text>
        <text y="83" textAnchor="middle" className={styles.circleStageDetail}>
          {remaining.length ? "use cases to update" : "ready to resolve"}
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
        <div className={styles.heroMeta}>
          <span>NEW IN THE LITELLM UI</span>
          <span>NOVEMBER 2026</span>
        </div>
        <h1 className={styles.heroTitle}>
          <span>Model Deprecation</span>
          <span>Management</span>
        </h1>
        <div className={styles.heroIntro}>
          <div>
            <p>The LiteLLM UI now has alerts for model deprecations.</p>
            <p>
              See which use cases need a new model, notify their owners, and
              confirm the move.
            </p>
          </div>
          <a
            className={styles.heroCta}
            href="#get-model-deprecation-alerts-in-the-litellm-ui"
          >
            See how it works <Arrow />
          </a>
        </div>
        <div className={styles.lifecycleIllustration}>
          <LifecycleCircle remaining={phase.remaining} selected={selected} />
          <LifecycleCircle
            remaining={phase.remaining}
            selected={selected}
            mobile
          />
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
