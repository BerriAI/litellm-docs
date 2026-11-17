import React, { useState } from "react";
import CodeBlock from "@theme/CodeBlock";
import ProviderLabel from "./ProviderLabel";
import { clientRequest, formatJson, providerExamples } from "./exampleData";
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

const lanes = [
  "M329 112C395 112 450 150 522 150S620 104 696 104",
  "M329 142C395 142 450 150 522 150S620 134 696 134",
  "M329 172C395 172 450 150 522 150S620 164 696 164",
  "M329 202C395 202 450 150 522 150S620 194 696 194",
];

export default function TokenizeScene() {
  const [run, setRun] = useState(0);

  return (
    <figure
      className={styles.scene}
      onPointerEnter={() => setRun((value) => value + 1)}
      aria-label="A prompt flows through LiteLLM to a unified JSON response"
    >
      <div className={styles.stage}>
        <svg
          key={run}
          className={styles.canvas}
          viewBox="0 0 696 300"
          aria-hidden="true"
          focusable="false"
        >
          {lanes.map((path, index) => (
            <g key={path}>
              <path d={path} className={styles.routeGuide} />
              <path
                d={path}
                className={styles.movingDots}
                style={{ "--delay": `${index * -0.25}s` }}
              />
            </g>
          ))}
          <g transform="translate(174 150)">
            <g className={styles.dots}>
              <path
                d={inputPlane.edges}
                transform="translate(-12 26)"
                className={styles.faintDots}
              />
              <path
                d={inputPlane.edges}
                transform="translate(-6 13)"
                className={styles.faintDots}
              />
            </g>
            <InputShape />
          </g>
          <g transform="translate(522 150)">
            <GatewayShape />
          </g>
        </svg>
        <div className={styles.output}>
          <div className={styles.outputHeading}>
            <span>response.json</span>
            <span>vLLM example</span>
          </div>
          <CodeBlock language="json" showLineNumbers={false}>
            {formatJson(providerExamples.vllm.response)}
          </CodeBlock>
        </div>
      </div>
      <div className={styles.labels}>
        <button
          type="button"
          className={styles.input}
          onClick={() => setRun((value) => value + 1)}
          aria-label="Replay tokenization of Hello world"
        >
          <span className={styles.eyebrow}>01 / YOUR PROMPT</span>
          <strong>{clientRequest.prompt}</strong>
          <span className={styles.replay}>
            Replay flow <span aria-hidden="true">↗</span>
          </span>
        </button>
        <div className={styles.label}>
          <span className={styles.eyebrow}>02 / LITELLM</span>
          <strong>/tokenize</strong>
          <span className={styles.providerLogos}>
            <ProviderLabel provider="vllm" />
            <ProviderLabel provider="watsonx" />
          </span>
        </div>
        <div className={`${styles.label} ${styles.outputLabel}`}>
          <span className={styles.eyebrow}>03 / YOUR TOKENS</span>
          <strong>One response format</strong>
          <span className={styles.providers}>Count, token IDs and text</span>
        </div>
      </div>
      <figcaption className={styles.caption}>
        Illustrative vLLM response. Your model determines the tokens and IDs.
        Watsonx uses the same fields with <code>token_ids: null</code>.
      </figcaption>
    </figure>
  );
}
