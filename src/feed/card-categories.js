// Copies a launch post's card_title / card_summary frontmatter into the RSS
// item's categories as "card_title:..." / "card_summary:..." so the LiteLLM
// Admin UI Home page can render short cards without parsing the title.
const CARD_FIELDS = ['card_title', 'card_summary'];

function cardCategories(frontMatter) {
  return CARD_FIELDS.filter((field) => typeof frontMatter[field] === 'string' && frontMatter[field].trim() !== '')
    .map((field) => {
      const label = `${field}:${frontMatter[field].trim()}`;
      return { name: label, term: label };
    });
}

function withCardCategories(items, blogPosts) {
  return items.map((item, index) => ({
    ...item,
    category: [...(item.category ?? []), ...cardCategories(blogPosts[index].metadata.frontMatter)],
  }));
}

// The feed lists every post so readers of it (the litellm.ai blog page builds
// its tag filters from the feed's categories) see the tags of older posts too.
// Only the newest FULL_TEXT_ITEMS keep their full HTML; older items carry the
// title, date, summary and tags, which keeps the feed close to its old size.
const FULL_TEXT_ITEMS = 50;

function withFullTextLimit(items, limit = FULL_TEXT_ITEMS) {
  return items.map((item, index) => (index < limit ? item : { ...item, content: undefined }));
}

async function createFeedItems({ blogPosts, defaultCreateFeedItems, ...rest }) {
  const items = await defaultCreateFeedItems({ blogPosts, ...rest });
  return withFullTextLimit(withCardCategories(items, blogPosts));
}

module.exports = { createFeedItems, withCardCategories, cardCategories, withFullTextLimit, FULL_TEXT_ITEMS };
