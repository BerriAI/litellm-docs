import React from 'react';
import BlogPostPaginator from '@theme-original/BlogPostPaginator';
import Newsletter from '@site/src/components/Newsletter';

// Every blog post ends with the newsletter signup, just above previous/next.
export default function BlogPostPaginatorWrapper(props) {
  return (
    <>
      <Newsletter source="blog-post" />
      <BlogPostPaginator {...props} />
    </>
  );
}
