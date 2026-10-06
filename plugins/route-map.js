const fs = require('fs');
const path = require('path');

function addRoute(routes, item) {
  if (!item?.source || !item?.permalink) return;
  const source = item.source.replace(/^@site\//, '');
  routes[source] = item.permalink;
}

module.exports = function routeMapPlugin() {
  const routes = {};

  return {
    name: 'litellm-route-map',

    async allContentLoaded({allContent}) {
      for (const docsInstance of Object.values(allContent['docusaurus-plugin-content-docs'] || {})) {
        for (const version of docsInstance.loadedVersions || []) {
          for (const doc of version.docs || []) {
            if (!doc.draft) addRoute(routes, doc);
          }
        }
      }

      const blog = allContent['docusaurus-plugin-content-blog']?.blog;
      for (const post of blog?.blogPosts || []) {
        if (!post.metadata?.frontMatter?.draft) addRoute(routes, post.metadata);
      }

      for (const page of allContent['docusaurus-plugin-content-pages']?.default || []) {
        if (!page.draft) addRoute(routes, page);
      }
    },

    async postBuild({outDir}) {
      const sortedRoutes = Object.fromEntries(
        Object.entries(routes).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      );
      await fs.promises.writeFile(path.join(outDir, 'route-map.json'), `${JSON.stringify(sortedRoutes, null, 2)}\n`);
    },
  };
};
