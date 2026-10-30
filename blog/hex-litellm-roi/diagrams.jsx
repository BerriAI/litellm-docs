import React from 'react';

export function HexIntro() {
  return (
    <section aria-label="LiteLLM and Hex" style={{background:'#1b3ee9',color:'#fff',padding:'clamp(24px,5vw,52px)',margin:'28px 0',fontFamily:'"DM Sans", sans-serif',position:'relative',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:18,borderBottom:'1px solid #ffffff66',paddingBottom:20}}>
        <img src="/img/brand/litellm-logo-white.png" alt="LiteLLM" style={{width:110,height:'auto',border:0}} />
        <span style={{fontFamily:'monospace',fontSize:12,letterSpacing:2}}> / HEX · TEMPLATE 1.0.0</span>
      </div>
      <p style={{fontSize:'clamp(30px,6vw,58px)',lineHeight:1.06,fontWeight:600,letterSpacing:'-0.04em',maxWidth:600,margin:'30px 0 22px'}}>Connect your spend.<br />Review each project.</p>
      <div style={{display:'flex',gap:20,flexWrap:'wrap',fontSize:13,borderTop:'1px solid #ffffff66',paddingTop:18}}>
        <span>Existing LiteLLM logs</span><span aria-hidden="true">↗</span><span>Read-only Postgres view</span><span aria-hidden="true">↗</span><span>Your Hex board</span>
      </div>
    </section>
  );
}

export function TemplateDownloads() {
  const style={display:'block',padding:'20px',background:'#fff',border:'1px solid #d9dee8',color:'#17233b',textDecoration:'none'};
  return <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:12,margin:'24px 0',fontFamily:'"DM Sans", sans-serif'}}>
    <a href="/hex/litellm_roi_demo.hex.yaml" download style={style}><strong style={{color:'#263cdb'}}>Try the demo ↗</strong><p style={{margin:'8px 0 0',fontSize:14}}>Import a Hex project with synthetic records.</p></a>
    <a href="/hex/litellm_roi_postgres.hex.yaml" download style={style}><strong style={{color:'#263cdb'}}>Connect Postgres ↗</strong><p style={{margin:'8px 0 0',fontSize:14}}>Use your existing LiteLLM spend logs.</p></a>
  </div>;
}
