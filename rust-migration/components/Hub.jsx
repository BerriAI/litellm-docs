import React from 'react';
import {Faq} from './Faq';
import {Tracker} from './Tracker';
import {Updates} from './Updates';

// The page at /rust-migration: progress tracker, engineering updates and FAQ.
export function RustMigrationHub() {
  return (
    <main className="rm-page">
      <header className="rm-hero">
        <p className="rm-eyebrow">Rust Migration</p>
        <h1 className="rm-title">LiteLLM is moving to Rust</h1>
        <p className="rm-description">See what already runs on Rust and what is next.</p>
      </header>
      <Tracker />
      <Updates />
      <Faq />
    </main>
  );
}
