import React from 'react';
import OriginalMetadata from '@theme-original/DocItem/Metadata';
import {PageMetadata} from '@docusaurus/theme-common';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import {usePluginData} from '@docusaurus/useGlobalData';

export default function DocItemMetadata() {
  const {metadata, frontMatter, assets} = useDoc();
  const {images} = usePluginData('social-cards');
  return <>
    <OriginalMetadata />
    {!(assets.image ?? frontMatter.image) && <PageMetadata image={images[metadata.permalink]} />}
  </>;
}
