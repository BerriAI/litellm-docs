export const CONFIG = Object.freeze({
  width: 1600,
  height: 836,
  mobileWidth: 800,
  mobileHeight: 700,
  light: {ink: '#242833', muted: '#BFC3C8', dots: '#87909C'},
  dark: {ink: '#E6EDF3', muted: '#71808E', dots: '#A2AFBC'},
  alt: 'LiteLLM × Microsoft 365 Copilot'
});

const defaults = {microsoft: './assets/microsoft-copilot.png'};

function background(width, height, colors) {
  return `<defs><pattern id="dots" width="50" height="50" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="3.5" fill="${colors.dots}" opacity=".12"/></pattern></defs><rect width="${width}" height="${height}" rx="32" fill="url(#dots)"/>`;
}

function cross(x, y, size, colors) {
  return `<path d="M${x-size} ${y-size}L${x+size} ${y+size}M${x-size} ${y+size}L${x+size} ${y-size}" fill="none" stroke="${colors.muted}" stroke-width="4"/>`;
}

export function svgScene(logoHref = './assets/litellm-logo-blue.png', providerHrefs = defaults, dark = false) {
  const c = dark ? CONFIG.dark : CONFIG.light;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CONFIG.width}" height="${CONFIG.height}" viewBox="0 0 1600 836" role="img" aria-label="${CONFIG.alt}">
${background(CONFIG.width, CONFIG.height, c)}
<image x="110" y="370" width="470" height="96" preserveAspectRatio="xMidYMid meet" xlink:href="${logoHref}"/>
${cross(643,418,9,c)}
<image x="706" y="356" width="124" height="124" preserveAspectRatio="xMidYMid meet" xlink:href="${providerHrefs.microsoft}"/>
<text x="858" y="438" font-family="Liberation Sans, Arial, sans-serif" font-size="58" font-weight="700" fill="${c.ink}">Microsoft 365 Copilot</text>
</svg>`;
}

export function mobileScene(logoHref = './assets/litellm-logo-blue.png', providerHrefs = defaults, dark = false) {
  const c = dark ? CONFIG.dark : CONFIG.light;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CONFIG.mobileWidth}" height="${CONFIG.mobileHeight}" viewBox="0 0 800 700" role="img" aria-label="${CONFIG.alt}">
${background(CONFIG.mobileWidth, CONFIG.mobileHeight, c)}
<image x="175" y="176" width="450" height="88" preserveAspectRatio="xMidYMid meet" xlink:href="${logoHref}"/>
${cross(400,340,10,c)}
<image x="145" y="420" width="124" height="124" preserveAspectRatio="xMidYMid meet" xlink:href="${providerHrefs.microsoft}"/>
<g font-family="Liberation Sans, Arial, sans-serif" font-size="52" font-weight="700" fill="${c.ink}">
<text x="299" y="468">Microsoft 365</text>
<text x="299" y="531">Copilot</text>
</g></svg>`;
}
