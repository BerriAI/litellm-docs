import React, {type ReactNode} from "react";
import {VegaEmbed} from "react-vega";
import type {VisualizationSpec} from "vega-embed";
import styles from "./styles.module.css";

type Pair = {round: string; python: number; rust: number};

const colors = {python: "#f59e0b", rust: "#22c55e"};

const config = {
  background: "transparent",
  axis: {
    domain: false,
    gridColor: "#334155",
    labelColor: "#a8b3c4",
    tickColor: "#64748b",
    titleColor: "#cbd5e1",
  },
  legend: {
    labelColor: "#cbd5e1",
    orient: "top",
    title: null,
  },
  title: {
    anchor: "start",
    color: "#f8fafc",
    fontSize: 15,
    subtitleColor: "#a8b3c4",
    subtitleFontSize: 12,
  },
  view: {stroke: null},
};

const embedOptions = {actions: false, mode: "vega-lite" as const, renderer: "svg" as const};

function longForm(data: Pair[]) {
  return data.flatMap(({round, python, rust}) => [
    {round, path: "Python", value: python},
    {round, path: "Rust", value: rust},
  ]);
}

function pairedSpec(
  title: string,
  data: Pair[],
  domain: [number, number],
  unit: string,
): VisualizationSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    autosize: {type: "fit-x", contains: "padding"},
    width: "container",
    height: Math.max(120, data.length * 34),
    title,
    data: {values: longForm(data)},
    encoding: {
      x: {
        field: "value",
        type: "quantitative",
        scale: {domain, zero: false},
        axis: {title: unit},
      },
      y: {
        field: "round",
        type: "ordinal",
        sort: data.map(({round}) => round),
        axis: {title: null, labelLimit: 160},
      },
    },
    layer: [
      {
        mark: {type: "line", color: "#718096", strokeWidth: 2},
        encoding: {detail: {field: "round"}},
      },
      {
        mark: {type: "point", filled: true, size: 110},
        encoding: {
          color: {
            field: "path",
            type: "nominal",
            scale: {domain: ["Python", "Rust"], range: [colors.python, colors.rust]},
          },
          shape: {
            field: "path",
            type: "nominal",
            scale: {domain: ["Python", "Rust"], range: ["square", "circle"]},
            legend: null,
          },
          tooltip: [
            {field: "round", type: "nominal", title: "Trial"},
            {field: "path", type: "nominal", title: "Path"},
            {field: "value", type: "quantitative", title: unit, format: ".1f"},
          ],
        },
      },
    ],
    config,
  } as VisualizationSpec;
}

function barSpec(
  title: string,
  subtitle: string,
  data: Array<{path: string; value: number; note?: string}>,
  domain: [number, number],
  unit: string,
): VisualizationSpec {
  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    autosize: {type: "fit-x", contains: "padding"},
    width: "container",
    height: 100,
    title: {text: title, subtitle},
    data: {values: data},
    mark: {type: "bar", cornerRadiusEnd: 3},
    encoding: {
      x: {
        field: "value",
        type: "quantitative",
        scale: {domain},
        axis: {title: unit},
      },
      y: {field: "path", type: "nominal", sort: ["Python", "Rust"], axis: {title: null}},
      color: {
        field: "path",
        type: "nominal",
        scale: {domain: ["Python", "Rust"], range: [colors.python, colors.rust]},
        legend: null,
      },
      tooltip: [
        {field: "path", type: "nominal", title: "Path"},
        {field: "value", type: "quantitative", title: unit},
        {field: "note", type: "nominal", title: "Result"},
      ],
    },
    config,
  } as VisualizationSpec;
}

function Chart({spec}: {spec: VisualizationSpec}) {
  return <VegaEmbed className={styles.vega} spec={spec} options={embedOptions} />;
}

const oneMiB: Pair[] = [
  {round: "Round 1", python: 158.802, rust: 211.424},
  {round: "Round 2", python: 153.721, rust: 219.256},
  {round: "Round 3", python: 145.161, rust: 211.949},
  {round: "Round 4", python: 142.113, rust: 230.695},
  {round: "Round 5", python: 107.288, rust: 169.633},
  {round: "Round 6", python: 111.502, rust: 168.199},
];

const eightMiB: Pair[] = [
  {round: "Round 1", python: 21.183, rust: 41.588},
  {round: "Round 2", python: 22.716, rust: 37.117},
  {round: "Round 3", python: 23.665, rust: 38.857},
  {round: "Round 4", python: 21.963, rust: 34.618},
  {round: "Round 5", python: 20.387, rust: 35.286},
  {round: "Round 6", python: 17.347, rust: 34.414},
];

const delayChecks: Pair[] = [
  {round: "Concurrency 8", python: 70.0, rust: 66.4},
  {round: "Concurrency 64", python: 108.2, rust: 167.0},
];

export function OcrThroughputChart(): ReactNode {
  return (
    <figure className={styles.chart}>
      <Chart spec={pairedSpec(
        "1 MiB upload · concurrency 32",
        oneMiB,
        [80, 240],
        "Requests per second",
      )} />
      <Chart spec={pairedSpec(
        "8 MiB upload · concurrency 8",
        eightMiB,
        [10, 45],
        "Requests per second",
      )} />
      <figcaption>Six paired rounds on one CPU. Hover a point for its exact value. Source: the published primary-trial CSV.</figcaption>
    </figure>
  );
}

export function OcrProviderDelayChart(): ReactNode {
  return (
    <figure className={styles.chart}>
      <Chart spec={pairedSpec(
        "100 ms provider delay · 1 MiB upload",
        delayChecks,
        [0, 180],
        "Requests per second",
      )} />
      <figcaption>Single run. Hover a point for its exact value.</figcaption>
    </figure>
  );
}

export function OcrFixedArrivalChart(): ReactNode {
  return (
    <figure className={styles.chart}>
      <div className={styles.split}>
        <Chart spec={barSpec("Completed throughput", "30 offered RPS · 8 MiB upload", [
          {path: "Python", value: 17.6, note: "Queued; varies across reruns"},
          {path: "Rust", value: 30.0, note: "Kept up with arrivals"},
        ], [0, 30], "Requests per second")} />
        <Chart spec={barSpec("p95 response latency", "30 offered RPS · 8 MiB upload", [
          {path: "Python", value: 3730, note: "3.73 seconds"},
          {path: "Rust", value: 32, note: "32 milliseconds"},
        ], [0, 4000], "Milliseconds")} />
      </div>
      <figcaption>Single run.</figcaption>
    </figure>
  );
}
