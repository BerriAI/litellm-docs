import React from 'react';
import OriginalPage from '@theme-original/DocCategoryGeneratedIndexPage';
import {usePluginData} from '@docusaurus/useGlobalData';

export default function DocCategoryGeneratedIndexPage(props) {
  const {images} = usePluginData('social-cards');
  const category = props.categoryGeneratedIndex;
  return <OriginalPage {...props} categoryGeneratedIndex={{
    ...category,
    image: category.image ?? images[category.permalink],
  }} />;
}
