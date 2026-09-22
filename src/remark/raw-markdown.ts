import type {VFile} from 'vfile';
import {substitute} from './docs-models';

// The copy-as-markdown button gets the source with {{role}} model ids filled in.
export default function remarkRawMarkdown() {
  return (_tree: unknown, vfile: VFile): void => {
    const frontMatter = (vfile.data.frontMatter ??= {}) as Record<
      string,
      unknown
    >;
    const source = substitute(String(vfile.value));
    frontMatter.rawMarkdownB64 = Buffer.from(source).toString('base64');
  };
}
