/**
 * Blog post page, laid out like a post on https://www.litellm.ai/blog:
 * a framed column with a "← Blog" row, tag pills, a large title and the
 * cover image, a "Published" row with the authors, then the article body.
 *
 * This replaces the stock BlogPostPage layout (no sidebar, no TOC) but keeps
 * its metadata, structured data, draft/unlisted banners and the
 * #__blog-post-container id that the RSS feed generator reads.
 */
import React, {useEffect} from 'react';
import clsx from 'clsx';
import {HtmlClassNameProvider, ThemeClassNames} from '@docusaurus/theme-common';
import {BlogPostProvider, useBlogPost} from '@docusaurus/plugin-content-blog/client';
import {blogPostContainerID} from '@docusaurus/utils-common';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import BlogPostPaginator from '@theme/BlogPostPaginator';
import BlogPostPageMetadata from '@theme/BlogPostPage/Metadata';
import BlogPostPageStructuredData from '@theme/BlogPostPage/StructuredData';
import ContentVisibility from '@theme/ContentVisibility';
import MDXContent from '@theme/MDXContent';
import styles from './styles.module.css';

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function isExternal(src) {
  return /^(https?:)?\/\//.test(src);
}

function Cover({image, Hero}) {
  const resolved = useBaseUrl(typeof image === 'string' ? image : '');
  if (!image && !Hero) return null;
  const src = typeof image === 'string' && !isExternal(image) ? resolved : image;
  return (
    <div className={styles.cover}>
      {Hero ? <Hero /> : <img src={src} alt="" />}
    </div>
  );
}

function Author({author, imageURL}) {
  const {name, title, url} = author;
  const avatar = imageURL ? <img src={imageURL} alt="" className={styles.avatar} /> : null;
  const label = <b>{name}</b>;
  return (
    <span className={styles.author}>
      {url && avatar ? (
        <a href={url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
          {avatar}
        </a>
      ) : (
        avatar
      )}
      <span>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className={styles.authorLink}>
            {label}
          </a>
        ) : (
          label
        )}
        {title && <small>{title}</small>}
      </span>
    </span>
  );
}

export function PostByline() {
  const {metadata, assets} = useBlogPost();
  const authorImages = assets.authorsImageUrls || [];
  return (
    <div className={clsx(styles.page, styles.immersiveByline)}>
      <div className={styles.inner}>
        <span className={styles.published}>
          Published: <time dateTime={metadata.date}>{formatDate(metadata.date)}</time>
        </span>
        <div className={styles.authors}>
          {metadata.authors.map((author, index) => (
            <Author
              key={author.key || author.name}
              author={author}
              imageURL={authorImages[index] ?? author.imageURL}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const EMBED_CSS = `
.navbar, footer, .theme-announcement-bar, .crisp-client { display: none !important; }
:root { --ifm-navbar-height: 0px; }
`;

function useEmbedMode() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('embed') !== '1') return undefined;
    const style = document.createElement('style');
    style.textContent = EMBED_CSS;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);
}

function BlogPostPageContent({children, Hero}) {
  useEmbedMode();
  const {metadata, assets} = useBlogPost();
  const {title, date, tags, authors, nextItem, prevItem, frontMatter} = metadata;
  const coverImage = frontMatter.hide_cover ? undefined : (assets.image ?? frontMatter.image);
  const authorImages = assets.authorsImageUrls || [];

  if (frontMatter.custom_hero) {
    return (
      <Layout>
        <article className={styles.immersive}>
          <ContentVisibility metadata={metadata} />
          <div id={blogPostContainerID} className="markdown">
            <MDXContent>{children}</MDXContent>
          </div>
        </article>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.frame}>
          <div className={styles.wrap}>
            <article className={styles.post}>
              <div className={clsx(styles.row, styles.top)}>
                <Link to="/blog" className={styles.back}>
                  <span aria-hidden="true">←</span> Blog
                </Link>
              </div>

              <header className={clsx(styles.row, styles.head)}>
                <div className={styles.inner}>
                  {tags.length > 0 && (
                    <div className={styles.pills}>
                      {tags.slice(0, 4).map(tag => (
                        <Link key={tag.permalink} to={tag.permalink} className={styles.pill}>
                          {tag.label}
                        </Link>
                      ))}
                    </div>
                  )}
                  <h1 className={styles.title}>{title}</h1>
                  <Cover image={coverImage} Hero={Hero} />
                </div>
              </header>

              <div className={clsx(styles.row, styles.byline)}>
                <div className={styles.inner}>
                  <span className={styles.published}>
                    Published: <time dateTime={date}>{formatDate(date)}</time>
                  </span>
                  {authors.length > 0 && (
                    <div className={styles.authors}>
                      {authors.map((author, index) => (
                        <Author
                          key={author.key || author.name}
                          author={author}
                          imageURL={authorImages[index] ?? author.imageURL}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className={clsx(styles.body, (coverImage || Hero) && styles.hasCover)}>
                <ContentVisibility metadata={metadata} />
                <div id={blogPostContainerID} className="markdown">
                  <MDXContent>{children}</MDXContent>
                </div>
              </div>

              {(nextItem || prevItem) && (
                <div className={styles.paginator}>
                  <BlogPostPaginator nextItem={nextItem} prevItem={prevItem} />
                </div>
              )}
            </article>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function BlogPostPage(props) {
  const BlogPostContent = props.content;
  return (
    <BlogPostProvider content={props.content} isBlogPostPage>
      <HtmlClassNameProvider
        className={clsx(ThemeClassNames.wrapper.blogPages, ThemeClassNames.page.blogPostPage)}>
        <BlogPostPageMetadata />
        <BlogPostPageStructuredData />
        <BlogPostPageContent Hero={BlogPostContent.Hero}>
          <BlogPostContent />
        </BlogPostPageContent>
      </HtmlClassNameProvider>
    </BlogPostProvider>
  );
}
