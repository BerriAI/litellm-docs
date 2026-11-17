// Website-only playback. HyperFrames owns the paused timeline during audits and exports.
if(new URLSearchParams(location.search).has('embed')){
 const timeline=window.__timelines.architecture;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const apply=({paused=false,theme='light'}={})=>{
  document.documentElement.dataset.theme=theme;
  if(reduce.matches){timeline.pause(5);return;}
  timeline.repeat(-1); paused?timeline.pause():timeline.play();
 };
 let settings={};apply(settings);
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='moyai-hero')return;
  settings=event.data;apply(settings);
 });
 reduce.addEventListener('change',()=>apply(settings));
 parent.postMessage({type:'moyai-hero-ready'},location.origin);
}
