import MDXComponents from '@theme-original/MDXComponents';
import type {MDXComponentsObject} from '@theme/MDXComponents';
import EnterpriseFeature from '@site/src/components/EnterpriseFeature';

// Components listed here are available in every .md/.mdx page without an import.
const components: MDXComponentsObject = {
  ...MDXComponents,
  EnterpriseFeature,
};

export default components;
