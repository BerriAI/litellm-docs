import React, { useState } from 'react';
import './visuals.css';

const EXAMPLES = Object.freeze({
  EUR: { input: 0.000001, output: 0.000002, usdRate: 1.1, symbol: '€' },
  JPY: { input: 0.00015, output: 0.0003, usdRate: 0.0067, symbol: '¥' },
});
const DISPLAY_RATES = Object.freeze({ USD: 1, EUR: 1.1, JPY: 0.0067 });
const money = (amount, currency) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency, currencyDisplay: 'code',
}).format(amount);

function CurrencyButtons({ value, onChange, currencies, label }) {
  return <div className="fx-buttons" role="group" aria-label={label}>
    {currencies.map(currency => <button type="button" key={currency}
      aria-pressed={value === currency} onClick={() => onChange(currency)}>{currency}</button>)}
  </div>;
}

export function RequestPricing() {
  const [currency, setCurrency] = useState('EUR');
  const example = EXAMPLES[currency];
  const nativeCost = 1000 * example.input + 500 * example.output;
  const usdCost = nativeCost * example.usdRate;
  return <figure className="fx-figure">
    <div className="fx-panel">
      <header className="fx-heading">
        <span className="fx-eyebrow">01 / YOUR PRICES, PER REQUEST</span>
        <h3>One gateway. Different currencies.</h3>
        <p>Choose a request currency and follow its cost.</p>
      </header>
      <div className="fx-request-toolbar">
        <span className="fx-pill">POST /v1/chat/completions</span>
        <CurrencyButtons value={currency} onChange={setCurrency} currencies={['EUR', 'JPY']} label="Request pricing currency" />
      </div>
      <div className="fx-request-grid" aria-live="polite" aria-atomic="true">
        <div className="fx-code-card" key={currency}>
          <div className="fx-card-label">REQUEST BODY</div>
          <pre><code>{`"pricing_currency": "${currency}",\n"input_cost_per_token": ${example.input},\n"output_cost_per_token": ${example.output}`}</code></pre>
          <div className="fx-token-row"><span>1,000 input tokens</span><span>500 output tokens</span></div>
        </div>
        <div className="fx-converter"><span className="fx-orbit">↗</span><strong>LiteLLM</strong><small>Reference-rate conversion</small></div>
        <div className="fx-cost-card" key={`${currency}-cost`}>
          <div className="fx-card-label">RECORDED SPEND</div>
          <strong className="fx-cost">${usdCost.toFixed(6)}</strong>
          <span className="fx-unit">USD</span>
          <div className="fx-equation">{currency} {nativeCost.toFixed(4)} × {example.usdRate}</div>
          <small>Configured model prices stay the same</small>
        </div>
      </div>
      <footer className="fx-footer"><span>Per-request overrides</span><span>Streaming + non-streaming</span><span>USD accounting</span></footer>
    </div>
    <figcaption>Interactive illustration. Sample token counts, prices, and exchange rates, not live quotes. Pricing permissions are required.</figcaption>
  </figure>;
}

export function ReferenceRates() {
  const [paused, setPaused] = useState(false);
  return <figure className={`fx-figure ${paused ? 'fx-paused' : ''}`}>
    <div className="fx-panel fx-rate-panel">
      <header className="fx-heading">
        <span className="fx-eyebrow">02 / AUTOMATIC REFERENCE RATES</span>
        <h3>Fetch once. Keep requests moving.</h3>
        <p>A usable snapshot serves conversions while refreshes happen when due.</p>
      </header>
      <button type="button" className="fx-pause" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? 'Resume animation' : 'Pause animation'}</button>
      <div className="fx-rate-flow">
        <div className="fx-rate-source"><span className="fx-source-icon">€</span><strong>European Central Bank</strong><small>Daily reference rates</small></div>
        <div className="fx-wire fx-wire-fetch" aria-hidden="true"><i /></div>
        <div className="fx-snapshot"><div className="fx-card-label">CACHED SNAPSHOT</div><strong>Ready to convert</strong><div><span>EUR</span><b>1.1000 USD</b></div><div><span>JPY</span><b>0.0067 USD</b></div><small>Illustrative rates · Nov 16, 2026</small></div>
        <div className="fx-wire" aria-hidden="true"><i /><i /><i /></div>
        <div className="fx-request-stack"><span>EUR request <b>USD spend</b></span><span>JPY request <b>USD spend</b></span><span>EUR request <b>USD spend</b></span></div>
      </div>
      <footer className="fx-footer"><span>Automatic lookup</span><span>Cached conversion</span><span>No lookup for USD-only requests</span></footer>
    </div>
    <figcaption>Conceptual flow with sample rates. Caches are held per worker. A non-USD request needs a usable rate before it can proceed.</figcaption>
  </figure>;
}

export function SpendDashboard() {
  const [currency, setCurrency] = useState('EUR');
  const [period, setPeriod] = useState('7');
  const [unavailable, setUnavailable] = useState(false);
  const usdSpend = period === '7' ? 12 : 42;
  const shown = unavailable ? 'USD' : currency;
  return <figure className="fx-figure">
    <div className="fx-panel fx-dashboard-panel">
      <header className="fx-heading">
        <span className="fx-eyebrow">03 / A FAMILIAR VIEW OF SPEND</span>
        <h3>Your spend. Another perspective.</h3>
        <p>Try the currency selector in this interactive dashboard illustration.</p>
      </header>
      <div className="fx-dashboard">
        <div className="fx-appbar"><span className="fx-brand">liteLLM <span>/ Usage</span></span><span className="fx-demo-label">Sample data</span></div>
        <div className="fx-dashboard-title"><div><h4>Usage</h4><p>Monitor your API usage and costs</p></div><label className="fx-period">Period<select aria-label="Sample reporting period" value={period} onChange={event => setPeriod(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label></div>
        <div className="fx-dashboard-tabs"><strong>Overview</strong><span>Model activity</span><span>Tag activity</span></div>
        <div className="fx-stats">
          <div className="fx-spend-stat"><span className="fx-stat-label">Total Spend</span><strong className="fx-usd">${usdSpend.toFixed(2)}</strong>
            <label className="fx-spend-selector">Spend display<select value={shown} aria-label="Spend display currency" disabled={unavailable} onChange={event => setCurrency(event.target.value)}><option value="USD">USD</option><option value="EUR">EUR</option><option value="JPY">JPY</option></select></label>
            <div className="fx-estimate-slot" aria-live="polite" aria-atomic="true">
              {unavailable ? <p className="fx-unavailable">Currency estimates unavailable. Showing USD.</p> : shown !== 'USD' ? <div key={`${shown}-${period}`} className="fx-estimate"><strong>≈ {money(usdSpend / DISPLAY_RATES[shown], shown)}</strong><span>Reference date · Nov 16, 2026</span></div> : <p className="fx-usd-note">Spend is recorded in USD</p>}
            </div>
          </div>
          <div className="fx-secondary-stat"><span className="fx-stat-label">Total Requests</span><strong>{period === '7' ? '2,400' : '8,400'}</strong><span>Across your models</span></div>
          <div className="fx-secondary-stat"><span className="fx-stat-label">Total Tokens</span><strong>{period === '7' ? '1.8M' : '6.3M'}</strong><span>Input + output</span></div>
        </div>
        <div className="fx-dashboard-bottom"><span>One USD total. A dated currency estimate.</span><label><input type="checkbox" checked={unavailable} onChange={event => setUnavailable(event.target.checked)} /> Simulate unavailable rates</label></div>
      </div>
      <footer className="fx-footer"><span>Independent of request currency</span><span>Original USD total stays visible</span></footer>
    </div>
    <figcaption>Interactive illustration of the Usage spend card, with sample data and fixed illustrative rates. Charts, budgets, and exports remain USD.</figcaption>
  </figure>;
}
