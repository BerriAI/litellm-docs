/**
 * Swizzled from @docusaurus/theme-classic to rotate the announcement bar and
 * to let an entry expire on its own.
 *
 * Only Content is overridden. The bar's container, close button and dismissal
 * storage are still the stock theme, so `announcementBar.id` and
 * `isCloseable` in docusaurus.config.js behave exactly as before. The config's
 * `content` is no longer used; entries live in src/announcements.js.
 *
 * Expiry is evaluated in the reader's browser. The site is statically built and
 * cached, so a page served after the cutoff would otherwise keep showing a dead
 * entry. The trade-off is that the markup for every entry ships in the bundle
 * and the cutoff is only as accurate as the reader's clock, which is fine for
 * hiding a finished event and would not be fine for anything confidential.
 */
import React, {useCallback, useEffect, useState} from 'react';
import clsx from 'clsx';
import {announcements} from '@site/src/announcements';
import styles from './styles.module.css';

const ROTATE_MS = 3000;
const RECHECK_MS = 60000;

function isLive(entry, now) {
  if (entry.startsAt && now < Date.parse(entry.startsAt)) {
    return false;
  }
  if (entry.expiresAt && now >= Date.parse(entry.expiresAt)) {
    return false;
  }
  return true;
}

// What the server renders. The build has no reader clock, so it emits only the
// entries that never expire; the dated ones appear once the client mounts.
const evergreen = announcements.filter((e) => !e.startsAt && !e.expiresAt);

export default function AnnouncementBarContent(props) {
  const [live, setLive] = useState(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const recompute = () =>
      setLive(announcements.filter((e) => isLive(e, Date.now())));
    recompute();
    // Catches the cutoff passing while a long-lived tab sits open.
    const timer = setInterval(recompute, RECHECK_MS);
    return () => clearInterval(timer);
  }, []);

  const items = live ?? evergreen;

  useEffect(() => {
    if (items.length < 2 || paused) {
      return undefined;
    }
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % items.length),
      ROTATE_MS,
    );
    return () => clearInterval(timer);
  }, [items.length, paused]);

  // The whole bar is one stretched link, so rotating it out from under a
  // pointer would send the reader somewhere they did not aim at.
  const hold = useCallback(() => setPaused(true), []);
  const release = useCallback(() => setPaused(false), []);

  const current = items[index % items.length];

  return (
    <div
      {...props}
      className={clsx(
        styles.content,
        !current && styles.empty,
        props.className,
      )}
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocusCapture={hold}
      onBlurCapture={release}>
      {current && (
        <span
          key={current.id}
          className={styles.item}
          // Entries are authored in this repo, same as the theme's own content.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{__html: current.html}}
        />
      )}
    </div>
  );
}
