// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

require('dotenv').config();

// @ts-ignore
const lightCodeTheme = require('prism-react-renderer/themes/vsLight');
// @ts-ignore
const darkCodeTheme = require('prism-react-renderer/themes/nightOwl');

const algoliaAppId = process.env.ALGOLIA_APP_ID;
const algoliaApiKey = process.env.ALGOLIA_API_KEY;
const algoliaIndexName = process.env.ALGOLIA_INDEX_NAME;
// conditional check, docs should work if these keys are missing.
const hasAlgoliaSearch =
  Boolean(algoliaAppId) && Boolean(algoliaApiKey) && Boolean(algoliaIndexName);

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'liteLLM',
  tagline: 'Simplify LLM API Calls',
  favicon: '/img/favicon.ico',

  url: 'https://docs.litellm.ai/',
  baseUrl: '/',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  plugins: [
    [
      '@docusaurus/plugin-ideal-image',
      {
        quality: 100,
        max: 1920,
        min: 640,
        steps: 2,
        disableInDev: false,
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'release-notes',
        path: './release_notes',
        routeBasePath: 'release_notes',
        sidebarPath: require.resolve('./sidebars-release-notes.js'),
        async sidebarItemsGenerator({defaultSidebarItemsGenerator, docs, ...args}) {
          const items = await defaultSidebarItemsGenerator({docs, ...args});

          const docYearMap = {};
          for (const doc of docs) {
            const date = doc.frontMatter && doc.frontMatter.date;
            if (date) {
              const year = new Date(date).getFullYear();
              docYearMap[doc.id] = year;
            }
          }

          function parseVersion(str) {
            const match = (str || '').match(/v?(\d+)\.(\d+)\.(\d+)/);
            if (!match) return [0, 0, 0];
            return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
          }
          function compareVersionsDesc(a, b) {
            const [aMaj, aMin, aPatch] = parseVersion(a.label || a.id || '');
            const [bMaj, bMin, bPatch] = parseVersion(b.label || b.id || '');
            if (bMaj !== aMaj) return bMaj - aMaj;
            if (bMin !== aMin) return bMin - aMin;
            return bPatch - aPatch;
          }

          function flattenDocs(list) {
            const result = [];
            for (const item of list) {
              if (item.type === 'doc' && item.id === 'index') continue;
              if (item.type === 'doc') {
                const label = item.id.replace(/\/index$/, '');
                result.push({...item, label});
              } else if (item.type === 'category') {
                if (item.link && item.link.type === 'doc' && item.link.id !== 'index') {
                  const id = item.link.id;
                  const label = id.replace(/\/index$/, '');
                  result.push({type: 'doc', id, label});
                } else {
                  result.push(...flattenDocs(item.items));
                }
              }
            }
            return result;
          }

          const docItems = flattenDocs(items);

          const byYear = {};
          for (const item of docItems) {
            const year = docYearMap[item.id] || 'Other';
            if (!byYear[year]) byYear[year] = [];
            byYear[year].push(item);
          }

          for (const year of Object.keys(byYear)) {
            byYear[year].sort(compareVersionsDesc);
          }

          const years = Object.keys(byYear).sort((a, b) => {
            const na = Number.parseInt(a, 10);
            const nb = Number.parseInt(b, 10);
            return nb - na;
          });
          return years.map(year => ({
            type: 'category',
            label: String(year),
            collapsed: year !== String(years[0]),
            items: byYear[year],
          }));
        },
      },
    ],
    [
      '@docusaurus/plugin-content-blog',
      {
        id: 'blog',
        path: './blog',
        routeBasePath: 'blog',
        blogTitle: 'Blog',
        blogSidebarTitle: 'All Posts',
        blogSidebarCount: 'ALL',
        postsPerPage: 'ALL',
        showReadingTime: false,
        sortPosts: 'descending',
        include: ['**/index.{md,mdx}'],
        remarkPlugins: [require('./src/remark/raw-markdown')],
      },
    ],

    () => ({
      name: 'cripchat',
      injectHtmlTags() {
        return {
          headTags: [
            {
              tagName: 'script',
              innerHTML: `window.$crisp=[];window.CRISP_WEBSITE_ID="be07a4d6-dba0-4df7-961d-9302c86b7ebc";(function(){d=document;s=d.createElement("script");s.src="https://client.crisp.chat/l.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();`,
            },
          ],
        };
      },
    }),
    () => ({
      name: 'gtag-shim',
      injectHtmlTags() {
        return {
          headTags: [
            {
              tagName: 'script',
              innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}if(!window.gtag){window.gtag=gtag;}`,
            },
          ],
        };
      },
    }),
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        gtag:
          process.env.NODE_ENV === 'production'
            ? {
                trackingID: 'G-K7K215ZVNC',
                anonymizeIP: true,
              }
            : undefined,
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          remarkPlugins: [require('./src/remark/raw-markdown')],
        },
        blog: false,
        pages: {},
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],
  markdown: {
    mermaid: true,
  },

  scripts: [
    {
      async: true,
      src: 'https://www.feedbackrocket.io/sdk/v1.2.js',
      'data-fr-id': 'GQwepB0f0L-x_ZH63kR_V',
      'data-fr-theme': 'dynamic',
    },
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/docusaurus-social-card.png',
      navbar: {
        title: '🚅 LiteLLM',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            type: 'docSidebar',
            sidebarId: 'learnSidebar',
            position: 'left',
            label: 'Learn',
          },
          {
            type: 'docSidebar',
            sidebarId: 'integrationsSidebar',
            position: 'left',
            label: 'Integrations',
          },
          {
            position: 'left',
            label: 'Enterprise',
            to: 'docs/enterprise',
          },
          {to: '/release_notes', label: 'Changelog', position: 'left'},
          {to: '/blog', label: 'Blog', position: 'left'},
          {
            href: 'https://docs.litellm-agent-platform.ai/',
            label: 'LiteLLM Agent Platform',
            position: 'left',
          },
          {
            href: 'https://github.com/BerriAI/litellm',
            position: 'right',
            className: 'header-github-link',
            'aria-label': 'GitHub repository',
          },
          {
            href: 'https://www.litellm.ai/support',
            position: 'right',
            className: 'header-discord-link',
            'aria-label': 'Discord / Slack community',
          },
          ...(hasAlgoliaSearch
            ? [{type: 'search', position: 'right'}]
            : []),
        ],
      },
      ...(hasAlgoliaSearch
        ? {
            algolia: {
              appId: algoliaAppId,
              apiKey: algoliaApiKey,
              indexName: algoliaIndexName,
              contextualSearch: true,
              searchPagePath: 'search',
            },
          }
        : {}),
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Getting Started',
                to: 'https://docs.litellm.ai/docs/',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.com/invite/wuPM9dRgDw',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/LiteLLM',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/BerriAI/litellm/',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} liteLLM`,
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
