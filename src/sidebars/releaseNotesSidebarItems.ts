import type {PluginOptions} from '@docusaurus/plugin-content-docs';

type SidebarItemsGenerator = PluginOptions['sidebarItemsGenerator'];
type SidebarItem = Awaited<ReturnType<SidebarItemsGenerator>>[number];
type DocItem = Extract<SidebarItem, {id: string}>;
type CategoryItem = Extract<SidebarItem, {type: 'category'}>;
type Version = [major: number, minor: number, patch: number];

function parseVersion(value: string): Version {
  const match = value.match(/v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return [0, 0, 0];
  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ];
}

function docVersion(item: DocItem): Version {
  return parseVersion(item.label || item.id || '');
}

function compareVersionsDesc(a: DocItem, b: DocItem): number {
  const [aMaj, aMin, aPatch] = docVersion(a);
  const [bMaj, bMin, bPatch] = docVersion(b);
  if (bMaj !== aMaj) return bMaj - aMaj;
  if (bMin !== aMin) return bMin - aMin;
  return bPatch - aPatch;
}

// Flatten doc items, drop the index page, and label each release by its folder.
function flattenDocs(list: SidebarItem[]): DocItem[] {
  const result: DocItem[] = [];
  for (const item of list) {
    if (item.type === 'doc' && item.id === 'index') continue;
    if (item.type === 'doc') {
      result.push({...item, label: item.id.replace(/\/index$/, '')});
    } else if (item.type === 'category') {
      if (item.link?.type === 'doc' && item.link.id !== 'index') {
        const {id} = item.link;
        result.push({
          type: 'doc' as const,
          id,
          label: id.replace(/\/index$/, ''),
        });
      } else {
        result.push(...flattenDocs(item.items));
      }
    }
  }
  return result;
}

function buildMinorCategories(
  yearItems: DocItem[],
  expandNewest: boolean,
): CategoryItem[] {
  const byMinor = new Map<
    string,
    {major: number; minor: number; items: DocItem[]}
  >();
  for (const item of yearItems) {
    const [major, minor] = docVersion(item);
    const key = `v${major}.${minor}.x`;
    if (!byMinor.has(key)) byMinor.set(key, {major, minor, items: []});
    byMinor.get(key)!.items.push(item);
  }
  return [...byMinor.entries()]
    .sort(([, a], [, b]) => b.major - a.major || b.minor - a.minor)
    .map(([key, group], index) => ({
      type: 'category',
      label: key,
      collapsed: !(expandNewest && index === 0),
      items: group.items.sort(compareVersionsDesc),
    }));
}

// Groups release notes by year (from front matter `date`), then by minor line.
export const releaseNotesSidebarItems: SidebarItemsGenerator = async ({
  defaultSidebarItemsGenerator,
  docs,
  ...args
}) => {
  const items = await defaultSidebarItemsGenerator({docs, ...args});

  const docYear = new Map<string, number>();
  for (const doc of docs) {
    const date = doc.frontMatter?.date;
    if (date) docYear.set(doc.id, new Date(date as string).getFullYear());
  }

  const byYear = new Map<string, DocItem[]>();
  for (const item of flattenDocs(items)) {
    const year = String(docYear.get(item.id) ?? 'Other');
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(item);
  }

  const years = [...byYear.keys()].sort(
    (a, b) => Number.parseInt(b, 10) - Number.parseInt(a, 10),
  );
  return years.map((year, index) => ({
    type: 'category',
    label: year,
    collapsed: year !== years[0],
    items: buildMinorCategories(byYear.get(year)!, index === 0),
  }));
};
