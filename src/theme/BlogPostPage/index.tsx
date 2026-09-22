import {useEffect, type ReactNode} from 'react';
import OriginalBlogPostPage from '@theme-original/BlogPostPage';
import type BlogPostPageType from '@theme/BlogPostPage';
import type {WrapperProps} from '@docusaurus/types';
import styles from './styles.module.css';

type Props = WrapperProps<typeof BlogPostPageType>;

function BackLink(): ReactNode {
  return (
    <div className={styles.backOuter}>
      <a href="/blog" className={styles.backLink}>
        <svg
          className={styles.backArrow}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16l-4-4m0 0l4-4m-4 4h18"
          />
        </svg>
        Blog
      </a>
    </div>
  );
}

export default function BlogPostPage(props: Props): ReactNode {
  // Add body class so CSS can hide the sidebar
  useEffect(() => {
    document.body.classList.add('blog-post-body');
    return () => document.body.classList.remove('blog-post-body');
  }, []);

  return (
    <>
      <BackLink />
      <OriginalBlogPostPage {...props} />
    </>
  );
}
