import React from 'react';
import Translate from '@docusaurus/Translate';
import {useLocation} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import styles from './styles.module.css';
import fallback from '@site/.i18n-staging/fallback.json';

export function isEnglishFallback(source, currentLocale, defaultLocale) {
  if (currentLocale === defaultLocale || typeof source !== 'string') {
    return false;
  }
  return Array.isArray(fallback[currentLocale]) && fallback[currentLocale].includes(source);
}

export default function EnglishFallbackNotice({source}) {
  const {i18n} = useDocusaurusContext();
  const {pathname} = useLocation();
  if (!isEnglishFallback(source, i18n.currentLocale, i18n.defaultLocale)) {
    return null;
  }
  const englishPath = pathname.replace(new RegExp(`^/${i18n.currentLocale}(?=/|$)`), '') || '/';
  return (
    <div className={styles.notice} role="note">
      <Translate id="i18n.englishFallback.message" description="Shown on localized routes that still render the English source">
        This page has not been translated yet, so you are reading the English version.
      </Translate>{' '}
      <a href={englishPath}>
        <Translate id="i18n.englishFallback.link" description="Link to the English route of the current page">
          Open the English page
        </Translate>
      </a>
    </div>
  );
}
