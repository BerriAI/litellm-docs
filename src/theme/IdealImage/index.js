import React from 'react';
import clsx from 'clsx';
import useIsBrowser from '@docusaurus/useIsBrowser';
import {useColorMode} from '@docusaurus/theme-common';

// Docs images load straight away as a plain responsive <img>. The stock
// IdealImage waits on slow or unstable connections and shows a blurred
// placeholder with "Click to load", then swaps in the sharp image, which made
// pages jump. The plugin still resizes each image at build time; this keeps
// its sizes in srcset and reserves the image's space so nothing shifts.
function PlainImage({img, alt = '', style, ...rest}) {
  if (typeof img === 'string' || (img && 'default' in img)) {
    const src = typeof img === 'string' ? img : img.default;
    return <img src={src} alt={alt} loading="lazy" decoding="async" style={style} {...rest} />;
  }
  const {src} = img;
  const images = src.images || [];
  return (
    <img
      src={src.src}
      srcSet={images.map((image) => `${image.path} ${image.width}w`).join(', ')}
      sizes="(max-width: 996px) 100vw, 900px"
      width={src.width}
      height={src.height}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{maxWidth: '100%', height: 'auto', ...style}}
      {...rest}
    />
  );
}

// Pass `dark={require('./x_dark.png')}` to show a dark-mode screenshot to
// readers on the dark theme. The color mode is only known once the page
// hydrates, so the server renders both and CSS hides the one that does not
// match; after that only the matching image is in the DOM.
export default function IdealImage({dark, className, ...props}) {
  const isBrowser = useIsBrowser();
  const {colorMode} = useColorMode();
  if (!dark) {
    return <PlainImage className={className} {...props} />;
  }
  if (isBrowser) {
    return <PlainImage key={colorMode} className={className} {...props} img={colorMode === 'dark' ? dark : props.img} />;
  }
  return (
    <>
      <PlainImage className={clsx(className, 'themed-media--light')} {...props} />
      <PlainImage className={clsx(className, 'themed-media--dark')} {...props} img={dark} />
    </>
  );
}
