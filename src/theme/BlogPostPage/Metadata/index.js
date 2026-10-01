import React from 'react';
import OriginalMetadata from '@theme-original/BlogPostPage/Metadata';
import {PageMetadata} from '@docusaurus/theme-common';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import {usePluginData} from '@docusaurus/useGlobalData';

export default function BlogPostPageMetadata() {
  const {metadata, assets} = useBlogPost();
  const {images} = usePluginData('social-cards');
  return <>
    <OriginalMetadata />
    {!(assets.image ?? metadata.frontMatter.image) && <PageMetadata image={images[metadata.permalink]} />}
  </>;
}
