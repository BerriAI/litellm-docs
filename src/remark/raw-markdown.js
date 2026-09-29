const {substitute} = require('./docs-models');

// The copy-as-markdown button gets the source with {{role}} model ids filled in.
function remarkRawMarkdown() {
  return (tree, vfile) => {
    vfile.data.frontMatter = vfile.data.frontMatter ?? {};
    const source = substitute(String(vfile.value));
    vfile.data.frontMatter.rawMarkdownB64 = Buffer.from(source).toString('base64');
  };
}

module.exports = remarkRawMarkdown;
