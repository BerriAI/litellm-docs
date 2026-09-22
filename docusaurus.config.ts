import 'dotenv/config';
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import optimizeImages from './plugins/optimize-images';
import remarkDocsModels from './src/remark/docs-models';
import remarkRawMarkdown from './src/remark/raw-markdown';
import {releaseNotesSidebarItems} from './src/sidebars/releaseNotesSidebarItems';

const lightCodeTheme = prismThemes.vsLight;
const darkCodeTheme = prismThemes.nightOwl;

const inkeepApiKey = process.env.INKEEP_API_KEY;
// Conditional check: docs should work if this key is missing.
const hasInkeepSearch = Boolean(inkeepApiKey);

const inkeepConfig = {
  baseSettings: {
    apiKey: inkeepApiKey,
    organizationDisplayName: 'liteLLM',
    primaryBrandColor: '#4965f5',
    theme: {
      styles: [
        {
          key: 'custom-theme',
          type: 'style',
          value: `
            .ikp-chat-button__button {
              margin-right: 80px !important;
            }
          `,
        },
      ],
      syntaxHighlighter: {
        lightTheme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    },
  },
  searchSettings: {
    searchBarPlaceholder: 'Search docs, guides, API reference...',
    debounceTimeMs: 0,
    maxResults: 7,
  },
  aiChatSettings: {
    aiAssistantName: 'LiteLLM AI',
    chatSubjectName: 'LiteLLM',
    aiAssistantAvatar: '/img/favicon.ico',
    placeholder: 'Ask anything about LiteLLM...',
    introMessage:
      'Hi! I can help you with LiteLLM — proxy setup, model routing, caching, spend tracking, and more. What would you like to know?',
    exampleQuestions: [
      'How do I set up the LiteLLM proxy?',
      'How do I route requests across multiple models?',
      'How do I enable response caching?',
      'How do I track spend per team or API key?',
    ],
    exampleQuestionsLabel: 'Common questions',
    isFirstExampleQuestionHighlighted: true,
    shouldOpenLinksInNewTab: true,
    isCopyChatButtonVisible: true,
    isShareButtonVisible: false,
    prompts: [
      'You are a helpful assistant specializing in LiteLLM. Answer questions about setup, configuration, model routing, the proxy server, caching, logging, and spend tracking. When referencing configuration options, include YAML or Python code examples where helpful. If a question is outside the scope of LiteLLM, politely redirect the user to the relevant docs or GitHub.',
    ],
  },
};

const config: Config = {
  title: 'liteLLM',
  tagline: 'Simplify LLM API Calls',
  favicon: '/img/favicon.ico',

  // Set the production url of your site here
  url: 'https://docs.litellm.ai/',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  plugins: [
    // vega-canvas tries to load the optional node `canvas` package during SSR.
    // Charts render as SVG, so resolve it to an empty module.
    () => ({
      name: 'ignore-optional-canvas',
      configureWebpack: () => ({resolve: {alias: {canvas: false}}}),
    }),
    optimizeImages,
    [
      '@docusaurus/plugin-client-redirects',
      {
        redirects: [
          {
            from: '/docs/proxy/control_plane_and_data_plane',
            to: '/docs/proxy/multi_region',
          },
          {
            from: '/docs/proxy/high_availability_control_plane',
            to: '/docs/proxy/global_control_plane',
          },
          {
            from: '/docs/proxy/deploy_cloud',
            to: '/docs/proxy/deploy',
          },
          {
            from: '/docs/proxy/microservices_helm',
            to: '/docs/proxy/deploy#deploy-with-helm',
          },
          {
            from: '/docs/proxy/db_deadlocks',
            to: '/docs/proxy/prod#redis-transaction-buffer',
          },
          {
            from: '/docs/proxy/ui_credentials',
            to: '/docs/proxy/model_management#reusable-provider-credentials',
          },
          {
            from: '/docs/proxy/ui_store_model_db_setting',
            to: '/docs/proxy/model_management#database-vs-configyaml-models',
          },
          {
            from: '/docs/router_architecture',
            to: '/docs/proxy/architecture#the-router-fallbacks-and-retries',
          },
          {
            from: '/docs/proxy/image_handling',
            to: '/docs/proxy/architecture#image-url-handling',
          },
          {
            from: '/docs/observability/langfuse_otel_integration',
            to: '/docs/observability/opentelemetry_v2#2-send-traces-to-a-specific-tool-presets',
          },
          {
            from: '/docs/observability/telemetry',
            to: '/docs/observability/opentelemetry_v2',
          },
        ],
      },
    ],
    ...(hasInkeepSearch
      ? [
          [
            '@inkeep/cxkit-docusaurus',
            {
              SearchBar: {
                ...inkeepConfig,
              },
              ChatButton: {
                ...inkeepConfig,
              },
            },
          ],
        ]
      : []),
    [
      '@docusaurus/plugin-ideal-image',
      {
        quality: 75,
        max: 1280,
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
        sidebarPath: './sidebars-release-notes.ts',
        sidebarItemsGenerator: releaseNotesSidebarItems,
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
        remarkPlugins: [remarkRawMarkdown],
        onInlineAuthors: 'throw',
        onUntruncatedBlogPosts: 'throw',
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
    // Ensure gtag exists before the GA script loads.
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
      {
        gtag:
          process.env.NODE_ENV === 'production'
            ? {
                // Two GA4 destinations. G-K7K215ZVNC is the docs property and
                // stays first: plugin-google-gtag uses trackingID[0] for the
                // gtag.js loader URL and emits one gtag('config', ...) per id.
                // G-G3LG9H6J6B is the canonical litellm.ai property, also on the
                // Webflow marketing site, so a visitor moving between
                // www.litellm.ai and docs.litellm.ai stays in one session.
                trackingID: ['G-K7K215ZVNC', 'G-G3LG9H6J6B'],
                anonymizeIP: true,
              }
            : undefined,
        docs: {
          sidebarPath: './sidebars.ts',
          beforeDefaultRemarkPlugins: [remarkDocsModels],
          remarkPlugins: [remarkRawMarkdown],
        },
        blog: false, // Disable the default blog plugin from preset-classic
        pages: {},
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  future: {
    // Opts into every Docusaurus v4 default, including the Rspack-based
    // "faster" build pipeline.
    v4: true,
  },

  themes: ['@docusaurus/theme-mermaid'],
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  scripts: [
    {
      async: true,
      src: 'https://www.feedbackrocket.io/sdk/v1.2.js',
      'data-fr-id': 'GQwepB0f0L-x_ZH63kR_V',
      'data-fr-theme': 'dynamic',
    },
  ],

  themeConfig: {
    // Replace with your project's social card
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
          type: 'docSidebar',
          sidebarId: 'autoRouterSidebar',
          position: 'left',
          label: 'Auto Router [Add-on]',
        },
        {
          href: 'https://trust.litellm.ai/',
          label: 'Trust Center',
          position: 'right',
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
        ...(hasInkeepSearch
          ? [{type: 'search', position: 'right' as const}]
          : []),
      ],
    },
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
  } satisfies Preset.ThemeConfig,
};

export default config;
