/**
 * Dark code-block theme used by docusaurus.io.
 * Source: https://github.com/facebook/docusaurus/blob/main/website/src/utils/prismDark.ts
 * Extends prism-react-renderer `vsDark` with the token colors from that file.
 * Base palette: https://github.com/FormidableLabs/prism-react-renderer (themes/vsDark).
 */
const vsDark = require('prism-react-renderer/themes/vsDark');

/** @type {import('prism-react-renderer').PrismTheme} */
const prismDark = {
  plain: {
    color: '#D4D4D4',
    backgroundColor: '#212121',
  },
  styles: [
    ...vsDark.styles,
    {
      types: ['title'],
      style: {
        color: '#569CD6',
        fontWeight: 'bold',
      },
    },
    {
      types: ['property', 'parameter'],
      style: {
        color: '#9CDCFE',
      },
    },
    {
      types: ['script'],
      style: {
        color: '#D4D4D4',
      },
    },
    {
      types: ['boolean', 'arrow', 'atrule', 'tag'],
      style: {
        color: '#569CD6',
      },
    },
    {
      types: ['number', 'color', 'unit'],
      style: {
        color: '#B5CEA8',
      },
    },
    {
      types: ['font-matter'],
      style: {
        color: '#CE9178',
      },
    },
    {
      types: ['keyword', 'rule'],
      style: {
        color: '#C586C0',
      },
    },
    {
      types: ['regex'],
      style: {
        color: '#D16969',
      },
    },
    {
      types: ['maybe-class-name'],
      style: {
        color: '#4EC9B0',
      },
    },
    {
      types: ['constant'],
      style: {
        color: '#4FC1FF',
      },
    },
  ],
};

module.exports = prismDark;
