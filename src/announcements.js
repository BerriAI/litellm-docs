/**
 * Announcement bar entries, newest first.
 *
 * The bar rotates through every entry that is currently live. One entry means
 * no rotation. Rendered by src/theme/AnnouncementBar/Content.
 *
 * Each entry:
 *   id         stable key, only used for React reconciliation
 *   html       the bar's inner HTML. Wrap the whole thing in one
 *              <a class="announcement-link"> so the stretched link in
 *              custom.css makes the entire bar clickable. Nested anchors do
 *              not work, so the call to action is part of that one link.
 *   startsAt   optional ISO instant before which the entry is hidden
 *   expiresAt  optional ISO instant at and after which the entry is hidden
 *
 * Dates are instants in UTC, so write the offset out rather than relying on
 * the reader's zone. US Pacific is UTC-7 until 1 November 2026 and UTC-8
 * after it, so 8:30 AM PT on 22 October is 15:30Z.
 *
 * Entries with no expiresAt are evergreen and are what the server renders,
 * because the build cannot know the reader's clock. See the Content component.
 */
export const announcements = [
  {
    id: 'october_townhall_2026',
    // Ends when the town hall ends: 22 October 2026, 8:30 AM PT.
    expiresAt: '2026-10-22T15:30:00Z',
    html:
      '<a class="announcement-link" href="https://forms.gle/F8tTYR8rfjKBA4D67" target="_blank" rel="noopener noreferrer">' +
      '<strong>LiteLLM October Town Hall.</strong> Thursday, Oct 22 at 7:30 AM PT. ' +
      'Product updates, roadmap and Q&amp;A. Register now &rarr;</a>',
  },
  {
    id: 'decisions_api_2026_10',
    html:
      '<a class="announcement-link" href="/docs/decisions">' +
      '<strong>Decisions API is here.</strong> Call Jev, Clef or any decision model ' +
      'through one /v1/decisions endpoint. &rarr;</a>',
  },
];

export default announcements;
