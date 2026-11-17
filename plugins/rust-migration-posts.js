const BLOG_PLUGIN = 'docusaurus-plugin-content-blog';
const RUST_TAG = 'rust-migration';

function hasRustTag(post) {
  return (post.metadata.tags || []).some((tag) => tag.label === RUST_TAG);
}

function toPostRow({metadata}) {
  return {
    title: metadata.title,
    permalink: metadata.permalink,
    date: new Date(metadata.date).toISOString(),
    description: metadata.description,
    authors: (metadata.authors || []).map(({name, url}) => ({name, url})),
  };
}

/**
 * Exposes every blog post tagged `rust-migration` as global data so the
 * /rust-migration hub renders straight from the blog instead of a hand-kept
 * list that goes stale on the next post.
 */
module.exports = function rustMigrationPostsPlugin() {
  return {
    name: 'rust-migration-posts',
    allContentLoaded({allContent, actions}) {
      const blogInstances = Object.values(allContent[BLOG_PLUGIN] || {});
      const posts = blogInstances
        .flatMap((instance) => instance?.blogPosts || [])
        .filter(hasRustTag)
        .map(toPostRow)
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      actions.setGlobalData({posts});
    },
  };
};
