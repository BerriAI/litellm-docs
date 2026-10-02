const {createHash} = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const {renderSocialCard} = require('../scripts/social-card/index.cjs');

function sidebarPages(items, section) {
  return items.flatMap((item) => {
    if (item.type === 'doc' || item.type === 'ref') return [{id: item.id, section}];
    if (item.type !== 'category') return [];
    const link = item.link;
    const page = link?.type === 'doc'
      ? {id: link.id, section: item.label}
      : link?.type === 'generated-index'
        ? {permalink: link.permalink, title: link.title ?? item.label, image: link.image, section}
        : null;
    return [...(page ? [page] : []), ...sidebarPages(item.items, item.label)];
  });
}

function collectPages(allContent) {
  const docs = Object.entries(allContent['docusaurus-plugin-content-docs'] ?? {}).flatMap(([id, content]) =>
    content.loadedVersions.flatMap((version) => {
      const section = id === 'release-notes' ? 'Release notes' : 'Documentation';
      const sidebars = Object.fromEntries(Object.entries(version.sidebars).map(([name, items]) =>
        [name, sidebarPages(items, section)]));
      return [
        ...version.docs.map((doc) => ({
          permalink: doc.permalink,
          title: doc.title,
          image: doc.frontMatter.image,
          section: sidebars[doc.sidebar]?.find((page) => page.id === doc.id)?.section ?? section,
        })),
        ...Object.values(sidebars).flat().filter((page) => page.permalink),
      ];
    }));
  const posts = Object.values(allContent['docusaurus-plugin-content-blog'] ?? {}).flatMap((content) =>
    content.blogPosts.map(({metadata}) => ({
      permalink: metadata.permalink,
      title: metadata.title,
      image: metadata.frontMatter.image,
      section: 'Blog',
    })));
  return [...new Map([...docs, ...posts].filter((page) => !page.image).map((page) => [page.permalink, page])).values()];
}

module.exports = function socialCardsPlugin({siteDir, generatedFilesDir}) {
  const templateDir = path.join(siteDir, 'scripts/social-card');
  const outputDir = path.join(generatedFilesDir, 'social-cards/img/og');
  const templateFiles = ['index.cjs', 'assets/litellm-logo-blue.svg',
    'assets/LiberationSans-Regular.ttf', 'assets/LiberationSans-Bold.ttf'];

  return {
    name: 'social-cards',
    async allContentLoaded({allContent, actions}) {
      const templateHash = createHash('sha256');
      for (const file of templateFiles) templateHash.update(await fs.readFile(path.join(templateDir, file)));
      const templateVersion = templateHash.digest('hex');
      const pages = collectPages(allContent);
      await fs.mkdir(outputDir, {recursive: true});
      const cachedFiles = new Set(await fs.readdir(outputDir));
      const images = {};
      const files = new Set();
      for (let offset = 0; offset < pages.length; offset += 4) {
        await Promise.all(pages.slice(offset, offset + 4).map(async (page) => {
          const hash = createHash('sha256').update(templateVersion).update(JSON.stringify(page)).digest('hex').slice(0, 20);
          const filename = `${hash}.png`;
          if (!cachedFiles.has(filename)) {
            try {
              const image = await renderSocialCard(page);
              await fs.writeFile(path.join(outputDir, `${filename}.tmp`), image);
              await fs.rename(path.join(outputDir, `${filename}.tmp`), path.join(outputDir, filename));
            } catch (error) {
              throw new Error(`Could not generate the social preview for ${page.permalink}`, {cause: error});
            }
          }
          images[page.permalink] = `img/og/${filename}`;
          files.add(filename);
        }));
      }
      await Promise.all([...cachedFiles].filter((file) => !files.has(file)).map((file) => fs.unlink(path.join(outputDir, file))));
      actions.setGlobalData({images});
      console.log(`[social-cards] Ready: ${pages.length} page previews`);
    },
  };
};
