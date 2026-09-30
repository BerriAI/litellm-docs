import React from 'react';

// Docs images load straight away as a plain responsive <img>. The stock
// IdealImage waits on slow or unstable connections and shows a blurred
// placeholder with "Click to load", then swaps in the sharp image, which made
// pages jump. The plugin still resizes each image at build time; this keeps
// its sizes in srcset and reserves the image's space so nothing shifts.
export default function IdealImage({img, alt = '', style, ...rest}) {
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
