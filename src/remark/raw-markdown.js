const {substitute} = require('./docs-models');
const {sinceVersionAsText} = require('./since-version');

// The copy-as-markdown button gets the source with {{role}} model ids filled in and version badges as text.
function remarkRawMarkdown() {
  return (tree, vfile) => {
    vfile.data.frontMatter = vfile.data.frontMatter ?? {};
    const source = sinceVersionAsText(substitute(String(vfile.value)));
    vfile.data.frontMatter.rawMarkdownB64 = Buffer.from(source).toString('base64');
  };
}

module.exports = remarkRawMarkdown;
