import React from 'react';
import styles from './styles.module.css';

// A static diagram of the three ways LiteLLM handles a request. Each line
// reads left to right: what your app sends, what LiteLLM does, and which
// providers can answer it. Nothing moves, so the whole picture reads at once.
//
// Provider names are checked against src/data/providerCapabilities.json
// (embeddings, images, rerank), docs/text_to_speech.md (speech), and the
// pass-through routes in litellm/proxy/pass_through_endpoints.

const ROWS = [
  {
    name: 'Translated',
    caption: 'One chat request, in the format your app already uses.',
    gateway: 'Maps the format',
    // Any chat model works with every request format in this row, so the
    // providers are shared by all lines.
    lines: [
      {request: 'POST /v1/chat/completions', note: 'OpenAI format'},
      {request: 'POST /v1/responses', note: 'OpenAI format'},
      {request: 'POST /v1/messages', note: 'Anthropic format'},
      {request: 'generateContent', note: 'Google format'},
    ],
    sharedProviders: 'Anthropic, Bedrock, Azure OpenAI, Gemini, and any other chat provider',
    outcome: 'The answer comes back in the format your app sent.',
  },
  {
    name: 'Native',
    caption: 'One request shape for each endpoint.',
    gateway: 'Maps to each provider API',
    lines: [
      {request: 'POST /v1/embeddings', providers: 'OpenAI, Bedrock, Cohere, Mistral, and more'},
      {request: 'POST /v1/images/generations', providers: 'OpenAI, Bedrock, Gemini, Stability AI, and more'},
      {request: 'POST /v1/audio/speech', providers: 'OpenAI, Azure OpenAI, AWS Polly, ElevenLabs, and more'},
      {request: 'POST /v1/rerank', providers: 'Cohere, Bedrock, Jina AI, Voyage AI, and more'},
    ],
    outcome: 'The same request works for every provider of that endpoint.',
  },
  {
    name: 'Pass-through',
    caption: 'The API of one provider, called through LiteLLM.',
    gateway: 'Adds provider credentials, forwards unchanged',
    lines: [
      {request: '/anthropic/v1/messages', providers: 'Anthropic'},
      {request: '/bedrock/...', providers: 'Bedrock'},
      {request: '/gemini/...', providers: 'Google AI Studio'},
      {request: '/cohere/...', providers: 'Cohere'},
    ],
    outcome: 'Use it for a provider feature that LiteLLM does not map.',
  },
];

const SUMMARY =
  'Three request paths through LiteLLM Gateway. Translated: your app sends a chat request in the OpenAI, Anthropic, or Google format, and LiteLLM maps it to any chat provider. ' +
  'Native: your app calls an endpoint such as embeddings, images, speech, or rerank with one request shape, and LiteLLM maps it to each provider of that endpoint. ' +
  'Pass-through: your app calls the API of one provider through LiteLLM, which adds the provider credentials and forwards the request unchanged.';

function Row({row}) {
  const n = row.lines.length;
  const span = {gridRow: `1 / span ${n}`};
  return (
    <div className={styles.row}>
      <div className={styles.rowHead}>
        <span className={styles.rowName}>{row.name}</span>
        <span className={styles.rowCaption}>{row.caption}</span>
      </div>
      <div className={styles.flow}>
        <div className={styles.gateway} style={span}>
          <span className={styles.gatewayTitle}>LiteLLM Gateway</span>
          <span className={styles.gatewayNote}>{row.gateway}</span>
        </div>
        {row.lines.map((line, i) => {
          const at = {gridRow: i + 1};
          return (
            <React.Fragment key={line.request}>
              <div className={styles.request} style={at}>
                <code className={styles.chip}>{line.request}</code>
                {line.note && <span className={styles.note}>{line.note}</span>}
              </div>
              <span className={styles.arrowIn} style={at} aria-hidden="true" />
              {!row.sharedProviders && (
                <>
                  <span className={styles.arrowOut} style={at} aria-hidden="true" />
                  <span className={styles.providers} style={at}>
                    {line.providers}
                  </span>
                </>
              )}
            </React.Fragment>
          );
        })}
        {row.sharedProviders && (
          <>
            <span className={`${styles.arrowOut} ${styles.arrowShared}`} style={span} aria-hidden="true" />
            <span className={`${styles.providers} ${styles.shared}`} style={span}>
              {row.sharedProviders}
            </span>
          </>
        )}
      </div>
      <p className={styles.outcome}>{row.outcome}</p>
    </div>
  );
}

export default function EndpointPaths() {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.srOnly}>{SUMMARY}</figcaption>
      <div className={styles.header} aria-hidden="true">
        <span>Your app sends</span>
        <span />
        <span>LiteLLM Gateway</span>
        <span />
        <span>Providers</span>
      </div>
      {ROWS.map((row) => (
        <Row key={row.name} row={row} />
      ))}
    </figure>
  );
}
