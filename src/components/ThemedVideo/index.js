import React from 'react';
import useIsBrowser from '@docusaurus/useIsBrowser';
import {useColorMode} from '@docusaurus/theme-common';

// A short, silent, looping screen recording that plays like a GIF at a
// fraction of the size. `dark` and `darkPoster` are optional dark-theme
// versions; like IdealImage's `dark`, the server renders both and CSS hides
// the one that does not match until the page hydrates.
// require() gives a URL for an .mp4, and an ideal-image object for a .png;
// for the latter, use its largest resized version as the poster.
const url = (asset) => {
  if (typeof asset === 'string' || !asset) return asset;
  if ('default' in asset) return asset.default;
  const images = asset.src?.images || [];
  return images.length ? images[images.length - 1].path : asset.src?.src;
};

export default function ThemedVideo({src, dark, poster, darkPoster, title, aspectRatio = '16 / 9'}) {
  const isBrowser = useIsBrowser();
  const {colorMode} = useColorMode();
  const style = {display: 'block', width: '100%', height: 'auto', aspectRatio, borderRadius: 8};
  const video = (source, posterSrc, extra) => (
    <video muted loop playsInline controls title={title} aria-label={title} poster={url(posterSrc)} style={style} {...extra}>
      <source src={url(source)} type="video/mp4" />
    </video>
  );
  if (!dark) {
    return video(src, poster, {autoPlay: true, preload: 'metadata'});
  }
  if (isBrowser) {
    const isDark = colorMode === 'dark';
    return video(isDark ? dark : src, isDark ? darkPoster || poster : poster, {key: colorMode, autoPlay: true, preload: 'metadata'});
  }
  return (
    <>
      {video(src, poster, {className: 'themed-media--light', preload: 'none'})}
      {video(dark, darkPoster || poster, {className: 'themed-media--dark', preload: 'none'})}
    </>
  );
}
