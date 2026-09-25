import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function makeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-test-'));
  const w = (rel, content) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), {recursive: true});
    fs.writeFileSync(p, content);
  };
  w('docs/intro.md', `---
id: intro
slug: /intro
title: Introduction
description: What LiteLLM is
---

# Getting Started

LiteLLM is a \`proxy\` for LLMs. See [the docs](./other.md) for details.

- First item with \`code\`
- Second item

:::note Heads up
Admonition **content** here.
:::

| Col A | Col B |
| ----- | ----- |
| x     | y     |

\`\`\`bash
export KEY=value
# comment stays
\`\`\`

Final paragraph with https://example.com link.
`);
  w('docs/other.md', '# Other\n\nSome other page.\n');
  w('blog/post-one/index.md', `---
title: Post One
---

# Post One

A blog paragraph.

![pic](./img/a.png)
`);
  w('blog/post-one/img/a.png', 'png');
  w('release_notes/v1.md', `---
title: v1
---

import Tabs from '@theme/Tabs';

# Release v1

<Tabs>
<TabItem value="a" label="A">

Tab content paragraph.

</TabItem>
</Tabs>
`);
  w('src/pages/page.md', '# Page\n\nimport X from \'./styles.module.css\';\n\nPage text with ![i](./p.png).\n');
  fs.mkdirSync(path.join(root, 'src/pages/img'), {recursive: true});
  w('src/pages/p.png', 'p');
  return root;
}

// Fake fetch: translates each item's text to `ZH:${text}` and reports usage.
export function fakeFetch(calls, {transform = defaultTransform} = {}) {
  return async (url, init) => {
    calls.push({url, body: JSON.parse(init.body)});
    const items = JSON.parse(JSON.parse(init.body).messages[1].content.split('\n\n')[0]);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                translations: items.map((i) => ({id: i.id, text: transform(i.text)})),
              }),
            },
          },
        ],
        usage: {prompt_tokens: 10, completion_tokens: 5},
      }),
      text: async () => '',
    };
  };
}

function defaultTransform(t) {
  // keep heading markers so heading-level validation passes; prefix prose text
  const m = /^\s*#{1,6}\s*/.exec(t);
  return m ? `${m[0]}ZH:${t.slice(m[0].length)}` : `ZH:${t}`;
}

export function noLog() {}
