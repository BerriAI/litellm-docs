import { useState, useRef, useEffect, useCallback } from 'react';

function useLog() {
  const [entries, setEntries] = useState([]);
  const add = useCallback((level, tag, msg) => {
    const time = new Date().toTimeString().slice(0, 8);
    setEntries(prev => [...prev, { level, tag, msg, time, id: Date.now() + Math.random() }]);
  }, []);
  const clear = useCallback(() => setEntries([]), []);
  return { entries, add, clear };
}

export default function WebRTCTester() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('logs');
  const [proxyUrl, setProxyUrl] = useState('http://localhost:4000');
  const [apiKey, setApiKey] = useState('sk-<your-litellm-api-key>');
  const [model, setModel] = useState('gpt-4o-realtime-preview');
  const [status, setStatus] = useState('idle');
  const [flowStep, setFlowStep] = useState(0);
  const [tokenPreview, setTokenPreview] = useState('—');
  const [iceState, setIceState] = useState('—');
  const [connState, setConnState] = useState('—');
  const [dcState, setDcState] = useState('—');
  const [sdpOffer, setSdpOffer] = useState('');
  const [sdpAnswer, setSdpAnswer] = useState('');
  const [offerActive, setOfferActive] = useState(false);
  const [answerActive, setAnswerActive] = useState(false);
  const [audioStatus, setAudioStatus] = useState('Start a session first');
  const [micActive, setMicActive] = useState(false);
  const [bars, setBars] = useState(Array(28).fill(2));
  const [connected, setConnected] = useState(false);

  const { entries, add: log, clear: clearLogs } = useLog();
  const logRef = useRef(null);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const animRef = useRef(null);
  const tokenRef = useRef(null);
  const micRef = useRef(false);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [entries]);

  function drawBars() {
    animRef.current = requestAnimationFrame(drawBars);
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    setBars(Array.from({ length: 28 }, (_, i) => Math.max(2, ((data[i] || 0) / 255) * 42)));
  }

  function setupAnalyser(stream) {
    audioCtxRef.current = new AudioContext();
    const src = audioCtxRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioCtxRef.current.createAnalyser();
    analyserRef.current.fftSize = 64;
    src.connect(analyserRef.current);
    drawBars();
  }

  async function startSession() {
    const url = proxyUrl.trim().replace(/\/$/, '');
    const key = apiKey.trim();
    const mdl = model.trim();

    setConnected(true);
    setStatus('connecting');
    setFlowStep(1);

    // Step 1: ephemeral token
    log('step', 'STEP 1', `POST ${url}/v1/realtime/client_secrets`);
    let tokenResp;
    try {
      const r = await fetch(`${url}/v1/realtime/client_secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: mdl }),
      });
      log('info', 'HTTP', `${r.status} ${r.statusText}`);
      const raw = await r.text();
      if (!r.ok) { log('error', 'ERR', raw); stopSession(); return; }
      tokenResp = JSON.parse(raw);
      log('success', 'TOKEN', 'Received encrypted ephemeral token');
    } catch (e) {
      log('error', 'ERR', `client_secrets failed: ${e.message}`);
      stopSession(); return;
    }

    const token = tokenResp?.client_secret?.value ?? tokenResp?.value;
    if (!token) { log('error', 'ERR', `Cannot extract token: ${JSON.stringify(tokenResp)}`); stopSession(); return; }
    tokenRef.current = token;
    setTokenPreview(token.slice(0, 10) + '…');
    log('info', 'TOKEN', `Preview: ${token.slice(0, 10)}…`);

    // Step 2: PeerConnection
    log('step', 'STEP 2', 'Creating RTCPeerConnection');
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.oniceconnectionstatechange = () => {
      setIceState(pc.iceConnectionState);
      log('info', 'ICE', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setStatus('connected'); setFlowStep(3);
      }
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setStatus('error');
      }
    };

    pc.onconnectionstatechange = () => {
      setConnState(pc.connectionState);
      log('info', 'CONN', pc.connectionState);
    };

    pc.ontrack = (e) => {
      log('success', 'AUDIO', 'Remote audio track received from OpenAI');
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0];
      setupAnalyser(e.streams[0]);
      setAudioStatus('Receiving audio from OpenAI ✓');
    };

    const dc = pc.createDataChannel('oai-events');
    dcRef.current = dc;
    dc.onopen = () => { setDcState('open'); log('success', 'DC', 'Data channel open — ready!'); setStatus('connected'); };
    dc.onclose = () => { setDcState('closed'); log('warn', 'DC', 'Closed'); };
    dc.onmessage = (e) => {
      try { log('info', 'EVENT', JSON.parse(e.data).type ?? 'unknown'); }
      catch { log('info', 'EVENT', e.data.slice(0, 100)); }
    };

    // Mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      log('success', 'MIC', 'Microphone access granted');
      setAudioStatus('Mic active — waiting for remote audio');
      micRef.current = true;
      setMicActive(true);
    } catch (e) {
      log('warn', 'MIC', `Mic denied: ${e.message}`);
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      dest.stream.getTracks().forEach(t => pc.addTrack(t, dest.stream));
    }

    // Step 3: SDP offer
    log('step', 'STEP 3', 'Creating SDP offer');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    setSdpOffer(offer.sdp);
    setOfferActive(true);
    log('info', 'SDP', `Offer created (${offer.sdp.split('\n').length} lines)`);

    // Step 4: SDP exchange
    setFlowStep(2);
    log('step', 'STEP 4', `POST ${url}/v1/realtime/calls`);
    try {
      const r = await fetch(`${url}/v1/realtime/calls`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/sdp' },
        body: offer.sdp,
      });
      log('info', 'HTTP', `${r.status} ${r.statusText}`);
      if (!r.ok) { log('error', 'ERR', await r.text()); stopSession(); return; }
      const ans = await r.text();
      log('success', 'SDP', `Answer received (${ans.split('\n').length} lines)`);

      // Step 5: remote description
      log('step', 'STEP 5', 'Setting remote description');
      await pc.setRemoteDescription({ type: 'answer', sdp: ans });
      setSdpAnswer(ans);
      setAnswerActive(true);
      log('success', 'CONN', '✓ Session established — Browser ↔ LiteLLM ↔ OpenAI');
    } catch (e) {
      log('error', 'ERR', `calls failed: ${e.message}`);
      stopSession();
    }
  }

  function stopSession() {
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    tokenRef.current = null;
    micRef.current = false;
    setConnected(false);
    setStatus('idle');
    setFlowStep(0);
    setTokenPreview('—');
    setIceState('—');
    setConnState('—');
    setDcState('—');
    setMicActive(false);
    setOfferActive(false);
    setAnswerActive(false);
    setBars(Array(28).fill(2));
    setAudioStatus('Start a session first');
    log('warn', 'SESSION', 'Session stopped');
  }

  function toggleMic() {
    if (!streamRef.current) { log('warn', 'MIC', 'No active session'); return; }
    const next = !micRef.current;
    micRef.current = next;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = next; });
    setMicActive(next);
    log('info', 'MIC', next ? 'Unmuted' : 'Muted');
  }

  const f = (n) => flowStep >= n;

  return (
    <>
      <div className="wrt-wrap">
        {/* Toggle header */}
        <div className={`wrt-toggle${open ? '' : ' closed'}`} onClick={() => setOpen(o => !o)}>
          <div className="wrt-toggle-left">
            <div className="wrt-live-dot" />
            <div>
              <div className="wrt-toggle-title">INTERACTIVE TESTER</div>
              <div className="wrt-toggle-sub">Browser → LiteLLM → OpenAI · WebRTC</div>
            </div>
          </div>
          <span className={`wrt-chevron${open ? ' open' : ''}`}>▼</span>
        </div>

        {open && (
          <div className="wrt-body">
            {/* Sidebar */}
            <div className="wrt-sidebar">
              <div>
                <div className="wrt-label">Proxy Config</div>
                <div className="wrt-field">
                  <label>Proxy URL</label>
                  <input value={proxyUrl} onChange={e => setProxyUrl(e.target.value)} placeholder="http://localhost:4000" />
                </div>
                <div className="wrt-field">
                  <label>API Key</label>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-<your-litellm-api-key>" />
                </div>
                <div className="wrt-field">
                  <label>Model</label>
                  <input value={model} onChange={e => setModel(e.target.value)} />
                </div>
              </div>

              <div className="wrt-divider" />

              <div>
                <div className="wrt-label">Flow</div>
                <div className="wrt-flow">
                  <div className={`wrt-flow-box${f(1) ? ' active' : ''}`}>Browser</div>
                  <div className={`wrt-flow-arrow${f(1) ? ' active' : ''}`}>→</div>
                  <div className={`wrt-flow-box${f(1) ? ' active' : ''}`}>LiteLLM</div>
                  <div className={`wrt-flow-arrow${f(2) ? ' active' : ''}`}>→</div>
                  <div className={`wrt-flow-box${f(2) ? ' active' : ''}`}>OpenAI</div>
                </div>
              </div>

              <div className="wrt-divider" />

              <div>
                <div className="wrt-label">Controls</div>
                <button className="wrt-btn wrt-btn-primary" onClick={startSession} disabled={connected}>▶ Start Session</button>
                <button className="wrt-btn wrt-btn-danger" onClick={stopSession} disabled={!connected}>■ Stop</button>
                <button className="wrt-btn wrt-btn-ghost" onClick={clearLogs} style={{marginTop: 5}}>✕ Clear Logs</button>
              </div>

              <div className="wrt-divider" />

              <div>
                <div className="wrt-label">Session Info</div>
                <div className="wrt-meta">
                  {[['token', tokenPreview], ['ice', iceState], ['conn', connState], ['data ch.', dcState]].map(([k, v]) => (
                    <div className="wrt-meta-row" key={k}><span>{k}</span><span>{v}</span></div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div className="wrt-main">
              <div className="wrt-header">
                <span className="wrt-header-title">WEBRTC REALTIME TESTER</span>
                <div className="wrt-status-pill">
                  <div className={`wrt-status-dot${status !== 'idle' ? ` ${status}` : ''}`} />
                  <span style={{fontSize:10, color:'#4a5568'}}>{status}</span>
                </div>
              </div>

              <div className="wrt-tabs">
                {['logs','sdp','audio'].map(t => (
                  <div key={t} className={`wrt-tab${activeTab===t?' active':''}`} onClick={() => setActiveTab(t)}>
                    {t.toUpperCase()}
                  </div>
                ))}
              </div>

              {/* Logs */}
              <div className={`wrt-tab-content${activeTab==='logs'?' active':''}`}>
                <div className="wrt-log" ref={logRef}>
                  {entries.length === 0
                    ? <div className="wrt-empty"><div style={{fontSize:22,opacity:0.3}}>📡</div><div>Hit "Start Session" to begin</div></div>
                    : entries.map(e => (
                        <div key={e.id} className={`wrt-entry ${e.level}`}>
                          <span className="we-time">{e.time}</span>
                          <span className="we-tag">[{e.tag}]</span>
                          <span className="we-msg">{e.msg}</span>
                        </div>
                      ))
                  }
                </div>
              </div>

              {/* SDP */}
              <div className={`wrt-tab-content${activeTab==='sdp'?' active':''}`}>
                <div className="wrt-sdp-pane">
                  <div className="wrt-sdp-box">
                    <div className="wrt-sdp-hdr"><div className={`wrt-sdp-dot${offerActive?' active':''}`}/>SDP OFFER</div>
                    <textarea readOnly value={sdpOffer} placeholder="SDP offer appears here..." />
                  </div>
                  <div className="wrt-sdp-box">
                    <div className="wrt-sdp-hdr"><div className={`wrt-sdp-dot${answerActive?' active':''}`}/>SDP ANSWER</div>
                    <textarea readOnly value={sdpAnswer} placeholder="SDP answer appears here..." />
                  </div>
                </div>
              </div>

              {/* Audio */}
              <div className={`wrt-tab-content${activeTab==='audio'?' active':''}`}>
                <div className="wrt-audio-pane">
                  <div className="wrt-viz">
                    {bars.map((h, i) => (
                      <div key={i} className="wrt-bar" style={{height: h+'px', background: `hsl(${150-(h/42)*30},100%,55%)`}} />
                    ))}
                  </div>
                  <button className={`wrt-mic-btn${micActive?' active':''}`} onClick={toggleMic}>🎙️</button>
                  <div className="wrt-audio-status">{audioStatus}</div>
                  <audio ref={remoteAudioRef} autoPlay style={{display:'none'}} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}