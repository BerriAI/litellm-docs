import React, {useEffect} from 'react';
import OriginalBlogPostPage from '@theme-original/BlogPostPage';
import Link from '@docusaurus/Link';
import Translate from '@docusaurus/Translate';
import EnglishFallbackNotice from '@site/src/components/EnglishFallbackNotice';
import styles from './styles.module.css';

function BackLink() {
  return (
    <div className={styles.backOuter}>
      <Link to="/blog" className={styles.backLink}>
        <svg className={styles.backArrow} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
        </svg>
        <Translate id="theme.blog.post.backToBlog">Blog</Translate>
      </Link>
    </div>
  );
}

export default function BlogPostPage(props) {
  // Add body class so CSS can hide the sidebar
  useEffect(() => {
    document.body.classList.add('blog-post-body');
    return () => document.body.classList.remove('blog-post-body');
  }, []);

  return (
    <>
      <BackLink />
      <div className={styles.backOuter}>
        <EnglishFallbackNotice source={props.content?.metadata?.source} />
      </div>
      <OriginalBlogPostPage {...props} />
    </>
  );
}
