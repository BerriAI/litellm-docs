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

async function createFeedItems({ blogPosts, defaultCreateFeedItems, ...rest }) {
  const items = await defaultCreateFeedItems({ blogPosts, ...rest });
  return withCardCategories(items, blogPosts);
}

module.exports = { createFeedItems, withCardCategories, cardCategories };
