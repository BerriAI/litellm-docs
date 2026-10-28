import React, { useState } from "react";
import { clientRequest, providerExamples } from "./exampleData";
import styles from "./tokenIdExplainer.module.css";

const example = providerExamples.vllm.response;

export default function TokenIdExplainer() {
  const [selected, setSelected] = useState(0);
  return (
    <div id="token-ids" className={styles.explainer}>
      <div className={styles.heading}>
        <span>FOLLOW ONE TOKEN</span>
        <h3>A token ID is a vocabulary entry number</h3>
        <p>
          A tokenizer splits text into pieces called tokens. Each piece has an
          entry in that tokenizer’s vocabulary, with a number called its token
          ID. Click either piece below to follow the lookup.
        </p>
      </div>
      <div className={styles.diagram}>
        <div className={styles.step}>
          <span className={styles.stepLabel}>01 / SPLIT THE TEXT</span>
          <div className={styles.prompt}>
            &quot;{clientRequest.prompt}&quot;
          </div>
          <div
            role="group"
            aria-label="Select a token"
            className={styles.tokens}
          >
            {example.tokens.map((token, index) => (
              <button
                key={token}
                type="button"
                aria-pressed={selected === index}
                onClick={() => setSelected(index)}
              >
                {JSON.stringify(token)}
              </button>
            ))}
          </div>
          <p>The second piece includes the space before “world”.</p>
        </div>
        <div className={styles.step}>
          <span className={styles.stepLabel}>02 / LOOK UP EACH PIECE</span>
          <table className={styles.vocabulary}>
            <caption>Made-up vocabulary for this example</caption>
            <thead>
              <tr>
                <th scope="col">Token text</th>
                <th scope="col">Token ID</th>
              </tr>
            </thead>
            <tbody>
              {example.tokens.map((token, index) => (
                <tr key={token} data-selected={selected === index}>
                  <td>{JSON.stringify(token)}</td>
                  <td>{example.token_ids[index]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={styles.step}>
          <span className={styles.stepLabel}>03 / KEEP THE SAME ORDER</span>
          <div className={styles.ids} aria-label="Token IDs: 101, 102">
            <span>[</span>
            {example.token_ids.map((id, index) => (
              <React.Fragment key={id}>
                {index > 0 && <span>,</span>}
                <span data-selected={selected === index}>{id}</span>
              </React.Fragment>
            ))}
            <span>]</span>
          </div>
          <p>
            <strong>Count: {example.count} tokens.</strong> Count the entries in
            the list. The numbers 101 and 102 identify those entries.
          </p>
        </div>
      </div>
      <p className={styles.selection} aria-live="polite" aria-atomic="true">
        You selected <code>{JSON.stringify(example.tokens[selected])}</code>.
        Look up that piece in the vocabulary to get ID{" "}
        <code>{example.token_ids[selected]}</code>, then put it in position{" "}
        {selected + 1} of the output list.
      </p>
      <div className={styles.takeaway}>
        <h4>Why does a model need the number?</h4>
        <p>
          Models calculate with numbers. When you send a prompt for inference,
          the model uses each token ID to look up a learned vector: a list of
          numbers that represents that token. It processes those vectors to
          predict the next token. A /tokenize call stops at the token list; it
          does not generate a reply.
        </p>
        <p>
          These IDs are made up to show the lookup. Your tokenizer can split the
          text differently and use different numbers. An ID only makes sense
          with its matching vocabulary. vLLM returns IDs; Watsonx returns token
          text with <code>token_ids: null</code>.
        </p>
      </div>
    </div>
  );
}
