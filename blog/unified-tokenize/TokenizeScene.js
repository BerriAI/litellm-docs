import React, { useState } from "react";
import { clientRequest, providerExamples } from "./exampleData";
import styles from "./scene.module.css";

function dottedLine(from, to, spacing = 4) {
  const steps = Math.ceil(
    Math.hypot(to[0] - from[0], to[1] - from[1]) / spacing,
  );
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
  });
}

function dotPath(points) {
  return points
    .map(([x, y]) => `M${x.toFixed(2)},${y.toFixed(2)}h.01`)
    .join(" ");
}

function plane(project, columns, rows) {
  const surface = [];
  for (let column = 1; column < columns; column += 1) {
    for (let row = 1; row < rows; row += 1) {
      surface.push(project(column / columns, row / rows));
    }
  }
  const corners = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ].map(([u, v]) => project(u, v));
  const edges = corners.flatMap((point, index) =>
    dottedLine(point, corners[(index + 1) % 4]),
  );
  return { surface: dotPath(surface), edges: dotPath(edges) };
}

const inputProjection = (u, v) => [
  (u - 0.5) * 240 + (v - 0.5) * 70,
  (v - 0.5) * 140 - (u - 0.5) * 42,
];
const inputPlane = plane(inputProjection, 42, 24);
const inputLines = dotPath(
  [0.3, 0.47, 0.64].flatMap((v, index) =>
    dottedLine(
      inputProjection(0.14, v),
      inputProjection(index === 2 ? 0.6 : 0.86, v),
      3.7,
    ),
  ),
);
const gateRings = [-13, 0, 13].map((offset) =>
  dotPath(
    Array.from({ length: 148 }, (_, index) => {
      const angle = (index / 148) * Math.PI * 2;
      return [Math.cos(angle) * 35 + offset, Math.sin(angle) * 91];
    }),
  ),
);
const tokenPlane = plane(
  (u, v) => [(u - 0.5) * 105 + (v - 0.5) * 23, (v - 0.5) * 93 - (u - 0.5) * 15],
  19,
  16,
);

function InputShape() {
  return (
    <g className={styles.dots}>
      <path
        d={inputPlane.edges}
        transform="translate(-7 13)"
        className={styles.faintDots}
      />
      <path d={inputPlane.surface} className={styles.surfaceDots} />
      <path d={inputPlane.edges} className={styles.edgeDots} />
      <path d={inputLines} className={styles.inkDots} />
    </g>
  );
}

function GatewayShape() {
  return (
    <g className={styles.dots}>
      {gateRings.map((path, index) => (
        <path
          key={index}
          d={path}
          className={index === 2 ? styles.edgeDots : styles.ringDots}
        />
      ))}
      <path d="M-13-91h26M-13 91h26" className={styles.gateEdges} />
      <path d="M0-12 12 0 0 12-12 0Z" className={styles.gateCore} />
      <circle r="2" className={styles.coreDot} />
    </g>
  );
}

function OutputShape({ tokens }) {
  return (
    <g className={styles.dots}>
      {[-66, 66].map((offset, index) => (
        <g
          key={offset}
          transform={`translate(${offset} ${index === 0 ? -12 : 12})`}
        >
          <path
            d={tokenPlane.edges}
            transform="translate(-5 10)"
            className={styles.faintDots}
          />
          <path d={tokenPlane.surface} className={styles.surfaceDots} />
          <path d={tokenPlane.edges} className={styles.edgeDots} />
          <path
            d={dotPath(dottedLine([-30, 20], [29, 12], 4))}
            className={styles.inkDots}
          />
          <text x="0" y="-2" textAnchor="middle" className={styles.shapeText}>
            {JSON.stringify(tokens[index])}
          </text>
        </g>
      ))}
    </g>
  );
}

function ProviderRoutes({ provider }) {
  return (
    <>
      {[
        {
          key: "vllm",
          label: "vLLM",
          y: 64,
          curve: "M616 128C675 128 667 64 718 64S775 128 844 128",
        },
        {
          key: "watsonx",
          label: "Watsonx",
          y: 194,
          curve: "M616 132C675 132 667 194 718 194S775 132 844 132",
        },
      ].map((route) => (
        <g
          key={route.key}
          className={
            provider === route.key ? styles.selectedRoute : styles.idleRoute
          }
        >
          <path d={route.curve} className={styles.routeGuide} />
          {provider === route.key && (
            <path d={route.curve} className={styles.movingDots} />
          )}
          <circle cx="718" cy={route.y} r="3.5" className={styles.routeNode} />
          <text
            x="718"
            y={route.y + (route.key === "vllm" ? -17 : 25)}
            textAnchor="middle"
            className={styles.providerName}
          >
            {route.label}
          </text>
        </g>
      ))}
    </>
  );
}

function MobileShape({ children, narrow = false }) {
  return (
    <svg
      className={styles.mobileShape}
      viewBox={narrow ? "-75 -110 150 220" : "-170 -110 340 220"}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** @param {{provider: 'vllm' | 'watsonx', onProviderChange: (provider: 'vllm' | 'watsonx') => void}} props */
export default function TokenizeScene({ provider, onProviderChange }) {
  const [playing, setPlaying] = useState(true);
  const selected = providerExamples[provider];

  return (
    <figure
      className={`${styles.scene} ${playing ? "" : styles.paused}`}
      aria-label="One tokenize request across providers"
    >
      <div className={styles.providerRow}>
        <span className={styles.rowLabel}>SELECT PROVIDER</span>
        <div
          className={styles.providerButtons}
          role="group"
          aria-label="Hero provider"
        >
          <button
            type="button"
            aria-pressed={provider === "vllm"}
            onClick={() => onProviderChange("vllm")}
          >
            vLLM
          </button>
          <button
            type="button"
            aria-pressed={provider === "watsonx"}
            onClick={() => onProviderChange("watsonx")}
          >
            Watsonx
          </button>
        </div>
      </div>

      <svg
        className={styles.canvas}
        viewBox="0 0 1160 270"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M349 130C424 130 480 130 545 130"
          className={styles.routeGuide}
        />
        <path
          d="M349 130C424 130 480 130 545 130"
          className={styles.movingDots}
        />
        <path
          d="M349 105C427 105 475 125 545 128M349 156C427 156 475 135 545 132"
          className={styles.outerLanes}
        />
        <g transform="translate(195 130)">
          <InputShape />
        </g>
        <g transform="translate(580 130)">
          <GatewayShape />
        </g>
        <ProviderRoutes provider={provider} />
        <g transform="translate(986 130)">
          <OutputShape tokens={selected.response.tokens} />
        </g>
      </svg>

      <figcaption className={styles.labels}>
        <div className={styles.label}>
          <MobileShape>
            <InputShape />
          </MobileShape>
          <div className={styles.labelCopy}>
            <span className={styles.step}>01 / SAME INPUT</span>
            <strong>{clientRequest.prompt}</strong>
            <code>model: "{clientRequest.model}"</code>
          </div>
        </div>
        <div className={styles.label}>
          <MobileShape narrow>
            <GatewayShape />
          </MobileShape>
          <div className={styles.labelCopy}>
            <span className={styles.step}>02 / LITELLM GATEWAY</span>
            <strong>/tokenize</strong>
            <span className={styles.rust}>BUILT IN RUST</span>
          </div>
        </div>
        <div className={styles.label}>
          <MobileShape>
            <OutputShape tokens={selected.response.tokens} />
          </MobileShape>
          <div
            className={styles.labelCopy}
            aria-live="polite"
            aria-atomic="true"
          >
            <span className={styles.step}>
              03 / {selected.name.toUpperCase()} OUTPUT
            </span>
            <strong>count: {selected.response.count}</strong>
            <code>
              token_ids:{" "}
              {selected.response.token_ids === null
                ? "null"
                : `[${selected.response.token_ids.join(", ")}]`}
            </code>
            <code>
              tokens: [
              {selected.response.tokens
                .map((token) => JSON.stringify(token))
                .join(", ")}
              ]
            </code>
          </div>
        </div>
      </figcaption>
      <div className={styles.footnote}>
        <span>Illustrative tokens. Actual values depend on the model.</span>
        <button
          type="button"
          className={styles.motionControl}
          aria-label={
            playing ? "Pause token flow animation" : "Play token flow animation"
          }
          onClick={() => setPlaying(!playing)}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            {playing ? <path d="M4 3v6M8 3v6" /> : <path d="m4 2 5 4-5 4Z" />}
          </svg>
          {playing ? "Pause motion" : "Play motion"}
        </button>
      </div>
    </figure>
  );
}
