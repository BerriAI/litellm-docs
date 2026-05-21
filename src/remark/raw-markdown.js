function remarkRawMarkdown() {
  return (tree, vfile) => {
    vfile.data.frontMatter = vfile.data.frontMatter ?? {};
    vfile.data.frontMatter.rawMarkdownB64 = Buffer.from(String(vfile.value)).toString('base64');
  };
}

module.exports = remarkRawMarkdown;
