import React from 'react';
import {posts} from '../data/posts.snapshot';
import {FULL_DATE, formatDate} from './format';
import {SectionHeading} from './SectionHeading';

export function Updates() {
  // Snapshot of every blog post tagged `rust-migration`, kept by scripts/update-posts.mjs.
  const events = posts
    .map(post => ({kind: 'Blog post', title: post.title, href: post.permalink, date: post.date}))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <section className="rm-section" aria-labelledby="migration-updates-title">
      <SectionHeading id="migration-updates-title" kicker="Engineering updates" title="How we are getting there" />
      <ol className="rm-events">
        {events.map(event => (
          <li className="rm-event" key={event.href}>
            <p className="rm-eventMeta">
              <time dateTime={event.date}>{formatDate(FULL_DATE, event.date)}</time>
              {' · '}
              {event.kind}
            </p>
            <a className="rm-eventTitle" href={event.href}>{event.title}</a>
          </li>
        ))}
      </ol>
    </section>
  );
}
