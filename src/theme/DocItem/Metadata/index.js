import React from 'react';
import OriginalMetadata from '@theme-original/DocItem/Metadata';
import Head from '@docusaurus/Head';
import {PageMetadata} from '@docusaurus/theme-common';
import {useActivePlugin, useDoc} from '@docusaurus/plugin-content-docs/client';
import {usePluginData} from '@docusaurus/useGlobalData';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

// schema.org data for a release note: what it is, which LiteLLM version it
// covers, and when it shipped, for search and answer engines.
function ReleaseJsonLd() {
  const {metadata, frontMatter} = useDoc();
  const site = useDocusaurusContext().siteConfig.url.replace(/\/$/, '');
  const version = /(\d+\.\d+\.\d+[^/]*)/.exec(metadata.id)?.[1]?.replace(/-stable$/, '');
  const authors = (frontMatter.authors || []).filter((a) => a && typeof a === 'object' && a.name);
  const data = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: metadata.title,
    description: metadata.description,
    url: site + metadata.permalink,
    ...(frontMatter.date && {datePublished: new Date(frontMatter.date).toISOString()}),
    ...(metadata.lastUpdatedAt && {dateModified: new Date(metadata.lastUpdatedAt).toISOString()}),
    ...(authors.length && {author: authors.map((a) => ({'@type': 'Person', name: a.name, ...(a.url && {url: a.url})}))}),
    publisher: {'@type': 'Organization', name: 'LiteLLM', url: 'https://www.litellm.ai'},
    isPartOf: {'@type': 'WebPage', name: 'LiteLLM Changelog', url: `${site}/release_notes/`},
    ...(version && {
      about: {
        '@type': 'SoftwareApplication',
        name: 'LiteLLM',
        softwareVersion: version,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Linux, macOS, Windows',
      },
    }),
  };
  return (
    <Head>
      <script type="application/ld+json">{JSON.stringify(data)}</script>
    </Head>
  );
}

export default function DocItemMetadata() {
  const {metadata, frontMatter, assets} = useDoc();
  const {images} = usePluginData('social-cards');
  const isRelease = useActivePlugin()?.pluginId === 'release-notes' && metadata.id !== 'index';
  return <>
    <OriginalMetadata />
    {!(assets.image ?? frontMatter.image) && <PageMetadata image={images[metadata.permalink]} />}
    {isRelease && <ReleaseJsonLd />}
  </>;
}
