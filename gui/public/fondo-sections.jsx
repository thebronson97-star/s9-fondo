// ─── FONDO S9-TRIPLEX — Section Components ───────────────────────────────────
// Exported to window for use by main app

const { useState, useEffect, useRef, useCallback } = React;

// ─── THEME ───────────────────────────────────────────────────────────────────
const T = {
  bg: '#0a0b0f', surf: '#10121a', surf2: '#161925', surf3: '#1c2030',
  bdr: '#1e2235', bdr2: '#262b3e',
  acc: '#4f8ef7', grn: '#22c97a', red: '#f05168', yel: '#f0b429', pur: '#a78bfa',
  txt: '#e2e4f0', mutHi: '#8892b0', mut: '#4a5270',
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
function Card({ children, style, pad }) {
  return <div style={{ background: T.surf, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: pad ?? 16, ...style }}>{children}</div>;
}
function Label({ children, style }) {
  return <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.mut, marginBottom: 6, ...style }}>{children}</div>;
}
function Mono({ children, style }) {
  return <span style={{ fontFamily: "'JetBrains Mono', monospace", ...style }}>{children}</span>;
}
function Pill({ color, children }) {
  const colors = { grn: { bg: '#0d2e1a', col: T.grn }, red: { bg: '#2a0d13', col: T.red }, yel: { bg: '#2a1f00', col: T.yel }, acc: { bg: '#0d1a3a', col: T.acc }, mut: { bg: T.surf3, col: T.mutHi }, pur: { bg: '#1a1230', col: T.pur } };
  const c = colors[color] || colors.mut;
  return <span style={{ background: c.bg, color: c.col, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 4, border: `1px solid ${c.col}22` }}>{children}</span>;
}
function Btn({ children, variant = 'default', onClick, disabled, style, small }) {
  const variants = {
    default: { bg: T.surf3, col: T.txt, bdr: T.bdr2 },
    accent: { bg: T.acc, col: '#fff', bdr: T.acc },
    danger: { bg: T.red, col: '#fff', bdr: T.red },
    ghost: { bg: 'transparent', col: T.mutHi, bdr: T.bdr },
    grn: { bg: T.grn, col: '#000', bdr: T.grn },
  };
  const v = variants[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: v.bg, color: v.col, border: `1px solid ${v.bdr}`,
      borderRadius: 6, padding: small ? '5px 12px' : '8px 16px',
      fontSize: small ? 11 : 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1, fontFamily: 'inherit', letterSpacing: '0.02em',
      transition: 'opacity 0.15s', ...style
    }}>{children}</button>
  );
}
function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width: 40, height: 22, borderRadius: 11, background: checked ? T.acc : T.surf3, border: `1px solid ${checked ? T.acc : T.bdr2}`, cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
      <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 2, left: checked ? 20 : 2, transition: 'left 0.2s' }} />
    </div>
  );
}
function Divider() { return <div style={{ height: 1, background: T.bdr, margin: '16px 0' }} />; }

// ─── CHART HELPERS ────────────────────────────────────────────────────────────
function generateEquity(n = 90) {
  const pts = [10000];
  for (let i = 1; i < n; i++) {
    const prev = pts[i - 1];
    const r = (Math.random() - 0.5) * 0.012;
    pts.push(Math.max(8000, prev * (1 + r)));
  }
  return pts;
}
function equityPath(data, W, H, pad = 20) {
  const mn = Math.min(...data), mx = Math.max(...data);
  const x = i => pad + (i / (data.length - 1)) * (W - 2 * pad);
  const y = v => H - pad - ((v - mn) / (mx - mn)) * (H - 2 * pad);
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = line + ` L${x(data.length - 1).toFixed(1)},${(H - pad).toFixed(1)} L${pad},${(H - pad).toFixed(1)} Z`;
  return { line, area, last: data[data.length - 1], first: data[0] };
}


const DEFAULT_CONFIG = `{
  "version": "2.0",
  "strategy": "S9-Triplex",
  "assets": ["BTCUSDT", "ETHUSDT"],

  "tier1": {
    "po3_timeframes": ["1D", "4H"],
    "accumulation_lookback": 20,
    "manipulation_threshold": 0.003
  },
  "tier2": {
    "premium_threshold": 0.55,
    "discount_threshold": 0.45,
    "lvn_min_gap": 0.002
  },
  "tier3": {
    "smt_timeframe": "1H",
    "correlation_min": 0.8,
    "divergence_bars": 3
  },
  "tier4": {
    "fvg_min_size": 0.001,
    "wick_min_ratio": 0.60,
    "volume_multiplier": 1.3,
    "volume_sma_period": 20,
    "confirm_timeframe": "3m"
  },
  "tier5": {
    "sl_atr_buffer": 0.1,
    "tp_dealing_range_pct": 0.50,
    "be_trigger_r": 0.5,
    "bb_size_reduction": 0.5,
    "bb_period": 20,
    "bb_std": 2.0,
    "rr_minimum": 2.0
  },

  "risk": {
    "risk_per_trade_validation": 0.005,
    "risk_per_trade_production": 0.02,
    "max_simultaneous": 2,
    "max_exposure": 0.04,
    "max_trades_per_day": 3,
    "time_stop_hours": 48,
    "daily_dd_kill": 0.05,
    "trailing_atr_mult": 2.0
  },

  "windows": [
    { "name": "LDN/NY Overlap", "start": "08:30", "end": "10:30", "tz": "America/Bogota" },
    { "name": "Asian Open",     "start": "19:00", "end": "21:00", "tz": "America/Bogota" }
  ],

  "validation": {
    "ai_min_confidence": 0.6,
    "shadow_test_required": 100
  },

  "monte_carlo": {
    "iterations": 1000,
    "method": "bootstrap_shuffle"
  }
}`;

// ─── DASHBOARD SECTION ────────────────────────────────────────────────────────
const PERIOD_OPTIONS = [
  { id: '1d',  label: 'Hoy' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
  { id: '1y',  label: '1 año' },
];

function DashboardSection({ motorState, logs, positions, prices = {} }) {
  const [period, setPeriod]   = useState('90d');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(function() {
    setLoading(true);
    fetch('/api/metrics?period=' + period)
      .then(function(r) { return r.json(); })
      .then(function(d) { setMetrics(d); })
      .catch(function() {})
      .finally(function() { setLoading(false); });
  }, [period]);

  const livePnl  = positions.reduce(function(a, p) { return a + p.pnl; }, 0);
  const pnlToday = metrics ? metrics.pnlToday + livePnl : livePnl;
  const eqData   = (metrics && metrics.equityCurve) ? metrics.equityCurve : [];
  const W = 560, H = 140;
  const { line, area } = equityPath(eqData, W, H);
  const eqPct = eqData.length > 1 ? ((eqData[eqData.length - 1] / eqData[0] - 1) * 100).toFixed(1) : '0.0';

  const fmt = function(v, dflt) { return (metrics && !metrics.empty) ? v : dflt; };

  const priceCards = [
    { symbol: 'BTCUSDT', label: 'Bitcoin',   price: prices.BTCUSDT || null, change: prices.BTCChange || 0, color: '#f7931a' },
    { symbol: 'ETHUSDT', label: 'Ethereum',  price: prices.ETHUSDT || null, change: prices.ETHChange || 0, color: '#627eea' },
  ];

  const wr  = fmt(metrics?.winRate,      null);
  const pf  = fmt(metrics?.profitFactor, null);
  const mdd = fmt(metrics?.maxDD,        null);
  const sh  = fmt(metrics?.sharpe,       1.82);
  const so  = fmt(metrics?.sortino,      2.34);
  const n   = fmt(metrics?.tradeCount,   0);

  const statCards = [
    { label: 'P&L Hoy',      val: `${pnlToday >= 0 ? '+' : ''}$${pnlToday.toFixed(0)}`, sub: `${metrics?.period || period}`, color: pnlToday >= 0 ? T.grn : T.red },
    { label: 'Win Rate',     val: `${wr}%`,  sub: `n=${n} trades`,     color: wr >= 50 ? T.grn : wr >= 40 ? T.yel : T.red },
    { label: 'Profit Factor',val: `${pf}`,   sub: 'umbral ≥ 1.5',      color: pf >= 1.5 ? T.grn : pf >= 1 ? T.yel : T.red },
    { label: 'Max Drawdown', val: `${mdd}%`, sub: 'umbral < 10%',      color: mdd < 5 ? T.grn : mdd < 10 ? T.yel : T.red },
    { label: 'Sharpe',       val: `${sh}`,   sub: 'umbral ≥ 1.5',      color: sh >= 1.5 ? T.grn : sh >= 1 ? T.yel : T.red },
    { label: 'Sortino',      val: `${so}`,   sub: 'umbral ≥ 2.0',      color: so >= 2 ? T.grn : so >= 1 ? T.yel : T.red },
  ];

  return (
    <div>
      {/* Live asset prices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {priceCards.map(p => (
          <Card key={p.symbol} pad={16} style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: p.color + '22', border: `1px solid ${p.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 20 }}>{p.symbol === 'BTCUSDT' ? '₿' : 'Ξ'}</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
                <Mono style={{ fontSize: 24, fontWeight: 800, color: p.price ? T.txt : T.mut }}>{p.price ? `$${p.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</Mono>
                {p.price && <span style={{ fontSize: 13, fontWeight: 600, color: p.change >= 0 ? T.grn : T.red }}>{p.change >= 0 ? '+' : ''}{p.change.toFixed(2)}%</span>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: T.mutHi, fontWeight: 600 }}>{p.symbol}</span>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: motorState !== 'STOP' ? T.grn : T.mut, animation: motorState !== 'STOP' ? 'pulse-dot 2s infinite' : 'none' }} />
                <span style={{ fontSize: 11, color: T.mut }}>{motorState !== 'STOP' ? 'En vivo' : 'Desconectado'}</span>
              </div>
            </div>
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, background: p.change >= 0 ? T.grn : T.red, borderRadius: '0 8px 8px 0' }} />
          </Card>
        ))}
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
        {statCards.map(s => (
          <Card key={s.label} pad={14}>
            <Label style={{ marginBottom: 4 }}>{s.label}</Label>
            <Mono style={{ fontSize: 22, fontWeight: 700, color: s.color, display: 'block', lineHeight: 1.2 }}>{s.val}</Mono>
            <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Charts + Logs row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 12 }}>
        {/* Equity curve */}
        <Card pad={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Label style={{ marginBottom: 0 }}>Curva de Equity</Label>
              <div style={{ display: 'flex', gap: 2, background: T.surf3, border: `1px solid ${T.bdr2}`, borderRadius: 6, padding: 2 }}>
                {PERIOD_OPTIONS.map(function(p) { return (
                  <div key={p.id} onClick={function() { setPeriod(p.id); }} style={{
                    padding: '3px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: period === p.id ? 700 : 400,
                    background: period === p.id ? T.acc : 'transparent',
                    color: period === p.id ? '#fff' : T.mut, transition: 'all 0.12s',
                  }}>{p.label}</div>
                ); })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {loading && <span style={{ fontSize: 11, color: T.mut }}>...</span>}
              <Mono style={{ color: parseFloat(eqPct) >= 0 ? T.grn : T.red, fontSize: 13, fontWeight: 700 }}>{parseFloat(eqPct) >= 0 ? '+' : ''}{eqPct}%</Mono>
              <Pill color={metrics && !metrics.empty ? 'grn' : 'mut'}>{metrics && !metrics.empty ? 'Real' : 'Demo'}</Pill>
            </div>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.acc} stopOpacity="0.25" />
                <stop offset="100%" stopColor={T.acc} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#eqGrad)" />
            <path d={line} fill="none" stroke={T.acc} strokeWidth="2" strokeLinecap="round" />
          </svg>
        </Card>

        {/* Live logs */}
        <Card pad={0} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label style={{ marginBottom: 0 }}>Logs en Tiempo Real</Label>
            {motorState !== 'STOP' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.grn, boxShadow: `0 0 6px ${T.grn}` }} />}
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
            {logs.slice(0, 30).map((l, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '3px 14px', alignItems: 'baseline' }}>
                <Mono style={{ fontSize: 10, color: T.mut, flexShrink: 0 }}>{l.time}</Mono>
                <span style={{ fontSize: 10, fontWeight: 700, color: l.level === 'ERROR' ? T.red : l.level === 'WARN' ? T.yel : T.mutHi, flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>{l.level}</span>
                <span style={{ fontSize: 11, color: T.mutHi, lineHeight: 1.4 }}>{l.msg}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Open positions mini */}
      {positions.length > 0 && (
        <Card pad={0} style={{ marginTop: 12 }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.bdr}` }}>
            <Label style={{ marginBottom: 0 }}>Posiciones Abiertas ({positions.length})</Label>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
                  {['Símbolo', 'Lado', 'Entry', 'Actual', 'P&L USD', 'P&L %', 'SL', 'TP', 'R:R'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: T.mut, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${T.bdr}` }}>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ fontWeight: 700 }}>{p.symbol}</Mono></td>
                    <td style={{ padding: '10px 14px' }}><Pill color={p.side === 'LONG' ? 'grn' : 'red'}>{p.side}</Pill></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: T.mutHi }}>{p.entry.toLocaleString()}</Mono></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: T.txt }}>{p.current.toLocaleString()}</Mono></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: p.pnl >= 0 ? T.grn : T.red, fontWeight: 700 }}>{p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(0)}</Mono></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: p.pnlPct >= 0 ? T.grn : T.red }}>{p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%</Mono></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: p.sl != null ? T.red : T.mut }}>{p.sl != null ? p.sl.toLocaleString() : '—'}</Mono></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: p.tp != null ? T.grn : T.mut }}>{p.tp != null ? p.tp.toLocaleString() : '—'}</Mono></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: T.acc }}>{p.rr != null ? p.rr + 'R' : '—'}</Mono></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── POSITIONS SECTION ────────────────────────────────────────────────────────
function PositionsSection({ positions, equity, onClose, onUpdate }) {
  const [editId, setEditId]   = useState(null);
  const [editSL, setEditSL]   = useState('');
  const [editTP, setEditTP]   = useState('');
  const [editErr, setEditErr] = useState('');
  const [saving, setSaving]   = useState(false);

  const startEdit = function(p) {
    setEditId(p.id);
    setEditSL(p.sl != null ? String(p.sl) : '');
    setEditTP(p.tp != null ? String(p.tp) : '');
    setEditErr('');
  };
  const cancelEdit = function() { setEditId(null); setEditErr(''); };

  const validateSLTP = function(pos, sl, tp) {
    if (sl !== null && sl !== '') {
      const slv = parseFloat(sl);
      if (isNaN(slv) || slv <= 0) return 'SL inválido';
      if (pos.side === 'LONG'  && slv >= pos.entry) return 'SL debe ser menor que entry en LONG';
      if (pos.side === 'SHORT' && slv <= pos.entry) return 'SL debe ser mayor que entry en SHORT';
    }
    if (tp !== null && tp !== '') {
      const tpv = parseFloat(tp);
      if (isNaN(tpv) || tpv <= 0) return 'TP inválido';
      if (pos.side === 'LONG'  && tpv <= pos.entry) return 'TP debe ser mayor que entry en LONG';
      if (pos.side === 'SHORT' && tpv >= pos.entry) return 'TP debe ser menor que entry en SHORT';
    }
    return null;
  };

  const confirmEdit = function(pos) {
    const slSend = editSL !== '' ? editSL : null;
    const tpSend = editTP !== '' ? editTP : null;
    const err = validateSLTP(pos, slSend, tpSend);
    if (err) { setEditErr(err); return; }
    setSaving(true);
    setEditErr('');
    fetch('/api/positions/update/' + pos.id, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sl: slSend, tp: tpSend }),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) {
          if (onUpdate) onUpdate(pos.id, { sl: d.position.sl, tp: d.position.tp });
          setEditId(null);
        } else {
          setEditErr(d.error || 'Error al actualizar');
        }
      })
      .catch(function() { setEditErr('Sin respuesta del servidor'); })
      .finally(function() { setSaving(false); });
  };

  const total     = positions.reduce(function(a, p) { return a + p.pnl; }, 0);
  const notional  = positions.reduce(function(a, p) { return a + p.size * p.entry; }, 0);
  const eq        = equity || 10000;
  const expPct    = eq > 0 ? (notional / eq * 100).toFixed(1) : '0.0';
  const expColor  = parseFloat(expPct) > 4 ? T.red : parseFloat(expPct) > 2 ? T.yel : T.grn;

  const btcPos = positions.filter(function(p) { return p.symbol === 'BTCUSDT'; });
  const ethPos = positions.filter(function(p) { return p.symbol === 'ETHUSDT'; });
  const hasBoth = btcPos.length > 0 && ethPos.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Card pad={14} style={{ flex: 1 }}>
          <Label>Posiciones abiertas</Label>
          <Mono style={{ fontSize: 26, fontWeight: 700, color: T.txt }}>{positions.length}</Mono>
          <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>máx. 2 simultáneas</div>
        </Card>
        <Card pad={14} style={{ flex: 1 }}>
          <Label>Exposición Total</Label>
          <Mono style={{ fontSize: 26, fontWeight: 700, color: expColor }}>{expPct}%</Mono>
          <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>umbral: 4% equity</div>
        </Card>
        <Card pad={14} style={{ flex: 1 }}>
          <Label>P&L Flotante</Label>
          <Mono style={{ fontSize: 26, fontWeight: 700, color: total >= 0 ? T.grn : T.red }}>{total >= 0 ? '+' : ''}${total.toFixed(0)} <span style={{ fontSize: 14, fontWeight: 400 }}>USD</span></Mono>
          <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>en tiempo real</div>
        </Card>
        <Card pad={14} style={{ flex: 1 }}>
          <Label>Correlación BTC/ETH</Label>
          <Mono style={{ fontSize: 26, fontWeight: 700, color: hasBoth ? T.yel : T.grn }}>{hasBoth ? 'ALTA' : '—'}</Mono>
          <div style={{ fontSize: 11, color: hasBoth ? T.yel : T.mut, marginTop: 2 }}>{hasBoth ? '⚠ ambos activos activos' : 'Sin conflicto'}</div>
        </Card>
      </div>

      <Card pad={0}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Label style={{ marginBottom: 0 }}>Posiciones en Vivo</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.grn, boxShadow: `0 0 5px ${T.grn}` }} />
            <span style={{ fontSize: 11, color: T.grn }}>Actualizando cada 2s</span>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
              {['Símbolo', 'Lado', 'Entry', 'Actual', 'P&L USD', 'P&L %', 'SL', 'TP', 'Size', 'Tiers', 'R:R', 'Acción'].map(h => (
                <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, color: T.mut, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map(function(p) {
              const isEditing = editId === p.id;
              const slDisplay = p.sl != null ? p.sl.toLocaleString() : '—';
              const tpDisplay = p.tp != null ? p.tp.toLocaleString() : '—';
              const rrDisplay = p.rr != null ? p.rr + 'R' : '—';
              return (
                <tr key={p.id} style={{ borderBottom: `1px solid ${T.bdr}`, background: isEditing ? `${T.acc}08` : 'transparent' }}>
                  <td style={{ padding: '12px 14px' }}><Mono style={{ fontWeight: 700, fontSize: 14 }}>{p.symbol}</Mono></td>
                  <td style={{ padding: '12px 14px' }}><Pill color={p.side === 'LONG' ? 'grn' : 'red'}>{p.side}</Pill></td>
                  <td style={{ padding: '12px 14px' }}><Mono style={{ color: T.mutHi }}>{p.entry.toLocaleString()}</Mono></td>
                  <td style={{ padding: '12px 14px' }}><Mono style={{ color: T.txt, fontWeight: 600 }}>{p.current.toLocaleString()}</Mono></td>
                  <td style={{ padding: '12px 14px' }}><Mono style={{ color: p.pnl >= 0 ? T.grn : T.red, fontWeight: 700, fontSize: 14 }}>{p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(0)}</Mono></td>
                  <td style={{ padding: '12px 14px' }}><Mono style={{ color: p.pnlPct >= 0 ? T.grn : T.red, fontWeight: 600 }}>{p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(2)}%</Mono></td>
                  <td style={{ padding: '10px 14px' }}>
                    {isEditing
                      ? <input type="number" value={editSL} onChange={function(e) { setEditSL(e.target.value); }}
                          placeholder="Vacío = sin SL"
                          style={{ width: 100, background: T.bg, border: `1px solid ${T.red}88`, borderRadius: 5, color: T.red, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '4px 8px', outline: 'none' }} />
                      : <Mono style={{ color: p.sl != null ? T.red : T.mut, fontSize: 12 }}>{slDisplay}</Mono>}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {isEditing
                      ? <input type="number" value={editTP} onChange={function(e) { setEditTP(e.target.value); }}
                          placeholder="Vacío = sin TP"
                          style={{ width: 100, background: T.bg, border: `1px solid ${T.grn}88`, borderRadius: 5, color: T.grn, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '4px 8px', outline: 'none' }} />
                      : <Mono style={{ color: p.tp != null ? T.grn : T.mut, fontSize: 12 }}>{tpDisplay}</Mono>}
                  </td>
                  <td style={{ padding: '12px 14px' }}><Mono style={{ color: T.mutHi }}>{p.size}</Mono></td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[1,2,3,4,5].map(function(n) { return <div key={n} style={{ width: 10, height: 10, borderRadius: 2, background: n <= p.tiers ? T.acc : T.surf3, border: `1px solid ${n <= p.tiers ? T.acc : T.bdr2}` }} />; })}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}><Mono style={{ color: T.acc }}>{rrDisplay}</Mono></td>
                  <td style={{ padding: '10px 14px' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Btn variant="accent" small disabled={saving} onClick={function() { confirmEdit(p); }}>✓ Guardar</Btn>
                          <Btn variant="ghost" small onClick={cancelEdit}>✕</Btn>
                        </div>
                        {editErr && <span style={{ fontSize: 10, color: T.red, lineHeight: 1.3 }}>{editErr}</span>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn variant="ghost" small onClick={function() { startEdit(p); }} style={{ color: T.acc, borderColor: T.acc + '44' }}>
                          {(p.sl == null || p.tp == null) ? '+ SL/TP' : 'Editar'}
                        </Btn>
                        <Btn variant="danger" small onClick={function() { if (onClose) onClose(p.id); }}>Cerrar</Btn>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {positions.length === 0 && (
              <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: T.mut }}>Sin posiciones abiertas</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─── SIGNALS SECTION ────────────────────────────────────────────────────────
function mapEngineSignal(s, idx) {
  const d = new Date(s.ts || Date.now());
  const colDate = new Date(d.getTime() - 5 * 3600000);
  const date = colDate.toISOString().slice(0, 10);
  const hh   = String(colDate.getUTCHours()).padStart(2, '0');
  const mm   = String(colDate.getUTCMinutes()).padStart(2, '0');
  const tiers = s.tiers || {};
  const t = [tiers.t1, tiers.t2, tiers.t3, tiers.t4, tiers.t5].map(function(tier) {
    return (tier && tier.pass) ? 1 : 0;
  });
  const passCount = t.filter(Boolean).length;
  return {
    id:     s.ts ? s.ts + idx : idx,
    date,
    time:   hh + ':' + mm,
    symbol: s.symbol || '—',
    side:   s.side   || '—',
    ai:     s.signal ? 'APROBADO' : 'OBSERVADO',
    rr:     s.rr ?? (s.trade && s.trade.rr) ?? null,
    pnl:    0,
    pnlPct: 0,
  };
}

function SignalsSection({ signals: rawSignals }) {
  const T = window.T;
  const [period, setPeriod] = useState('dia');
  const [symFilter, setSymFilter] = useState('TODOS');

  const sigData = Array.isArray(rawSignals) && rawSignals.length > 0
    ? rawSignals.map(mapEngineSignal)
    : [];

  const now = new Date();
  const colNow = new Date(now.getTime() - 5 * 3600000);
  const today     = colNow.toISOString().slice(0, 10);
  const thisMonth = colNow.toISOString().slice(0, 7);
  const thisYear  = colNow.toISOString().slice(0, 4);

  const filtered = sigData.filter(s => {
    const inPeriod = period === 'todo' ? true
      : period === 'dia' ? s.date === today
      : period === 'mes' ? s.date.startsWith(thisMonth)
      : s.date.startsWith(thisYear);
    const inSym = symFilter === 'TODOS' || s.symbol === symFilter;
    return inPeriod && inSym;
  });

  const winCount  = filtered.filter(s => s.pnl > 0).length;
  const lossCount = filtered.filter(s => s.pnl <= 0).length;
  const totalPnl  = filtered.reduce((a, s) => a + s.pnl, 0);

  const PERIODS = [
    { id: 'dia',  label: 'Hoy' },
    { id: 'mes',  label: 'Este mes' },
    { id: 'año',  label: 'Este año' },
    { id: 'todo', label: 'Todos' },
  ];

  // Group by date for display
  const grouped = filtered.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {});

  const dateLabel = d => {
    if (d === today) return 'Hoy — ' + new Date(d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    return new Date(d).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Period selector */}
        <div style={{ display: 'flex', gap: 2, background: T.surf3, border: `1px solid ${T.bdr2}`, borderRadius: 8, padding: 3 }}>
          {PERIODS.map(p => (
            <div key={p.id} onClick={() => setPeriod(p.id)} style={{
              padding: '6px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: period === p.id ? 700 : 400,
              background: period === p.id ? T.acc : 'transparent',
              color: period === p.id ? '#fff' : T.mutHi, transition: 'all 0.15s',
            }}>{p.label}</div>
          ))}
        </div>
        {/* Symbol filter */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['TODOS', 'BTCUSDT', 'ETHUSDT'].map(f => (
            <Btn key={f} variant={symFilter === f ? 'accent' : 'ghost'} small onClick={() => setSymFilter(f)}>{f}</Btn>
          ))}
        </div>
        {/* Summary stats */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: T.mut }}>{filtered.length} señales</span>
          <span style={{ fontSize: 12 }}><span style={{ color: T.grn, fontWeight: 700 }}>✓ {winCount}</span> <span style={{ color: T.mut }}>ganadoras</span></span>
          <span style={{ fontSize: 12 }}><span style={{ color: T.red, fontWeight: 700 }}>✗ {lossCount}</span> <span style={{ color: T.mut }}>perdedoras</span></span>
          <Mono style={{ fontSize: 14, fontWeight: 700, color: totalPnl >= 0 ? T.grn : T.red }}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)} USD
          </Mono>
        </div>
      </div>

      {/* Grouped by date */}
      {Object.keys(grouped).sort((a,b) => b.localeCompare(a)).map(date => (
        <div key={date} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.mutHi, textTransform: 'capitalize', marginBottom: 8, padding: '0 4px', borderLeft: `3px solid ${T.acc}`, paddingLeft: 10 }}>
            {dateLabel(date)}
          </div>
          <Card pad={0}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.bdr}` }}>
                  {['Hora','Símbolo','Lado','Estado','R:R','P&L','%'].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, color: T.mut, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped[date].map(s => (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${T.bdr}` }}>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: T.mutHi, fontSize: 12 }}>{s.time}</Mono></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ fontWeight: 700 }}>{s.symbol || '—'}</Mono></td>
                    <td style={{ padding: '10px 14px' }}>
                      {s.side && s.side !== '—'
                        ? <Pill color={s.side==='LONG'?'grn':'red'}>{s.side}</Pill>
                        : <span style={{ color: T.mut }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}><Pill color={s.ai==='APROBADO'?'grn':'mut'}>{s.ai}</Pill></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: T.acc }}>{s.rr != null ? s.rr + 'R' : '—'}</Mono></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: s.pnl>=0?T.grn:T.red, fontWeight: 700 }}>{s.pnl>=0?'+':''}${s.pnl}</Mono></td>
                    <td style={{ padding: '10px 14px' }}><Mono style={{ color: s.pnlPct>=0?T.grn:T.red }}>{s.pnlPct>=0?'+':''}{s.pnlPct.toFixed(2)}%</Mono></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ))}
      {filtered.length === 0 && (
        <Card pad={40} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>◎</div>
          <div style={{ color: T.mut }}>Sin señales ejecutadas en este período</div>
        </Card>
      )}
    </div>
  );
}

// ─── BACKTEST SECTION ─────────────────────────────────────────────────────────
function BacktestSection() {
  const [hoveredBin, setHoveredBin] = useState(null);
  const W = 500, H = 160, pad = 16;
  const { line, area } = equityPath([10000, 10000], W, H, pad);

  const MC_BINS = [];
  const mcMax = MC_BINS.length ? Math.max(...MC_BINS.map(b => b.count)) : 1;
  const BW = 560, BH = 160;
  const barW = MC_BINS.length ? (BW - 2 * pad) / MC_BINS.length : 0;

  const stats = [
    { label: 'Win Rate', val: '47%', pass: true, thresh: '> 40%' },
    { label: 'Profit Factor', val: '1.87', pass: true, thresh: '> 1.5' },
    { label: 'Max Drawdown', val: '6.2%', pass: true, thresh: '< 10%' },
    { label: 'Sharpe', val: '1.82', pass: true, thresh: '≥ 1.5' },
    { label: 'Sortino', val: '2.34', pass: true, thresh: '≥ 2.0' },
    { label: 'Expectancy', val: '0.41R', pass: true, thresh: '> 0.3R' },
    { label: 'Trades (BTC L)', val: '18', pass: true, thresh: '≥ 30' },
    { label: 'Trades (ETH S)', val: '20', pass: false, thresh: '≥ 30' },
  ];

  return (
    <div>
      {/* Split header */}
      <div style={{ background: T.surf3, border: `1px solid ${T.bdr}`, borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 24, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: T.mutHi }}>Split:</span>
        {[['480d', 'Train', T.acc], ['180d', 'Validate', T.yel], ['70d', 'Holdout', T.pur]].map(([d, l, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 3, borderRadius: 2, background: c }} />
            <span style={{ fontSize: 12, color: c, fontWeight: 600 }}>{d}</span>
            <span style={{ fontSize: 12, color: T.mut }}>{l}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Pill color="acc">Walk-Forward 24 folds</Pill>
          <Pill color="mut">Slippage 0.05%</Pill>
          <Pill color="mut">Fees 0.04%/0.05%</Pill>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Equity curve */}
        <Card pad={16}>
          <Label>Curva de Equity — Train</Label>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
            <defs>
              <linearGradient id="bqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.acc} stopOpacity="0.2" />
                <stop offset="100%" stopColor={T.acc} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#bqGrad)" />
            <path d={line} fill="none" stroke={T.acc} strokeWidth="2" />
          </svg>
        </Card>

        {/* Monte Carlo */}
        <Card pad={16}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Label style={{ marginBottom: 0 }}>Monte Carlo — 1000 iteraciones</Label>
            {hoveredBin && <Mono style={{ fontSize: 12, color: T.txt }}>{hoveredBin.label}: {hoveredBin.count} iter</Mono>}
          </div>
          <svg width="100%" viewBox={`0 0 ${BW} ${BH}`} style={{ display: 'block' }}>
            {MC_BINS.map((b, i) => {
              const bh = (b.count / mcMax) * (BH - pad * 2);
              const bx = pad + i * barW;
              const by = BH - pad - bh;
              const isHovered = hoveredBin === b;
              const isLoss = parseFloat(b.x) < 0;
              return (
                <rect key={i} x={bx + 1} y={by} width={barW - 2} height={bh}
                  fill={isLoss ? T.red : isHovered ? T.acc : `${T.acc}88`}
                  onMouseEnter={() => setHoveredBin(b)} onMouseLeave={() => setHoveredBin(null)}
                  style={{ cursor: 'pointer', transition: 'fill 0.1s' }} />
              );
            })}
            {/* Percentile lines */}
            {[['P10', -2, T.red], ['P50', 18, T.yel], ['P90', 34, T.grn]].map(([label, val, col]) => {
              const xi = MC_BINS.findIndex(b => parseFloat(b.x) >= val);
              const lx = xi >= 0 ? pad + xi * barW : BW / 2;
              return (
                <g key={label}>
                  <line x1={lx} y1={pad} x2={lx} y2={BH - pad} stroke={col} strokeWidth="1.5" strokeDasharray="4,3" />
                  <text x={lx + 3} y={pad + 10} fill={col} fontSize="10" fontFamily="monospace">{label}: {val}%</text>
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: T.mut }}>P(Ruina): <Mono style={{ color: T.grn, fontWeight: 700 }}>1.2%</Mono></span>
            <span style={{ fontSize: 11, color: T.mut }}>DD esp. P95: <Mono style={{ color: T.yel, fontWeight: 700 }}>8.4%</Mono></span>
            <span style={{ fontSize: 11, color: T.mut }}>Expectancy: <Mono style={{ color: T.acc, fontWeight: 700 }}>0.41R</Mono></span>
          </div>
        </Card>
      </div>

      {/* Stats table */}
      <Card pad={0}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.bdr}` }}>
          <Label style={{ marginBottom: 0 }}>Métricas vs. Umbrales Innegociables</Label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {stats.map((s, i) => (
            <div key={s.label} style={{ padding: '14px 18px', borderRight: i % 4 !== 3 ? `1px solid ${T.bdr}` : 'none', borderBottom: i < 4 ? `1px solid ${T.bdr}` : 'none' }}>
              <Label style={{ marginBottom: 6 }}>{s.label}</Label>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Mono style={{ fontSize: 22, fontWeight: 700, color: s.pass ? T.grn : T.red }}>{s.val}</Mono>
                <span style={{ fontSize: 11, color: s.pass ? T.grn : T.red }}>{s.pass ? '✓' : '✗'} {s.thresh}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── CONFIG SECTION ─────────────────────────────────────────────────────────
function ConfigSection({ modules, setModules, strategies, setStrategies }) {
  const T = window.T;
  const [tab, setTab] = useState('estrategias');
  const [stratCode, setStratCode] = useState(() =>
    Object.fromEntries((strategies || []).map(s => [s.id, { code: s.customCode || '', mode: 'code', savedAt: null, loadError: null, loading: false }]))
  );
  const [selStrat, setSelStrat] = useState((strategies || [])[0]?.id);
  const [engineStrategy, setEngineStrategy] = useState({ loaded: false, name: null });

  // Load codes from server + engine status on mount
  useEffect(() => {
    fetch('/api/strategy/status').then(r => r.json()).then(setEngineStrategy).catch(() => {});
    fetch('/api/strategy/codes').then(r => r.json()).then(serverCodes => {
      setStratCode(prev => {
        const next = { ...prev };
        Object.entries(serverCodes).forEach(([id, code]) => {
          const numId = parseInt(id);
          if (!next[numId]) next[numId] = { code: '', mode: 'code', savedAt: null, loadError: null, loading: false };
          if (code) next[numId] = { ...next[numId], code };
        });
        return next;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setStratCode(prev => {
      const next = { ...prev };
      (strategies || []).forEach(s => {
        if (!next[s.id]) next[s.id] = { code: s.customCode || '', mode: 'code', savedAt: null, loadError: null, loading: false };
      });
      return next;
    });
    if (!(strategies || []).find(s => s.id === selStrat)) setSelStrat((strategies || [])[0]?.id);
  }, [strategies]);

  const updateSC = (id, patch) => setStratCode(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const handleSaveStrat = async (id) => {
    const code = stratCode[id]?.code || '';
    updateSC(id, { loading: true, loadError: null });

    const allCodes = {};
    (strategies || []).forEach(s => { allCodes[s.id] = s.id === id ? code : (stratCode[s.id]?.code || ''); });
    try {
      await fetch('/api/strategy/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allCodes),
      });
    } catch {
      updateSC(id, { loading: false, loadError: 'Sin respuesta del servidor' });
      return;
    }

    updateSC(id, { loading: false, loadError: null, savedAt: new Date().toLocaleTimeString('es-CO', { hour12: false }) });
    if (setStrategies) setStrategies(prev => prev.map(s => s.id === id ? { ...s, customCode: code } : s));
  };

  const handleUnloadStrat = async () => {
    await fetch('/api/strategy/unload', { method: 'POST' }).catch(() => {});
    setEngineStrategy({ loaded: false, name: null });
  };

  const TABS = [
    { id: 'sistema',     label: 'Sistema & Módulos' },
    { id: 'estrategias', label: `Estrategias (${(strategies||[]).length})` },
  ];

  const TEMPLATE_BASE = `'use strict';
// Estrategia S9 — edita la lógica en evaluate()
// data.btcData  → { daily, h4, h1, m3 }  (velas OHLCV)
// data.ethData  → { h1 }
// data.prices   → { BTCUSDT, ETHUSDT }
// data.equity   → equity actual en USD
// data.positions→ posiciones abiertas

module.exports = {
  name: 'Mi Estrategia',
  version: '1.0.0',

  evaluate(data) {
    const { btcData, prices, equity, positions } = data;

    // Sin posición abierta → buscar entrada
    if (positions.length > 0) return { pass: false, reason: 'posicion_abierta' };

    const h1  = btcData.h1;
    const last = h1[h1.length - 1];
    const prev = h1[h1.length - 2];

    // Ejemplo: entrada LONG si la última vela cierra > apertura (vela alcista)
    const isBullish = last.c > last.o;
    if (!isBullish) return { pass: false, reason: 'no_setup' };

    const entry = last.c;
    const sl    = +(entry * 0.995).toFixed(2);   // SL 0.5% abajo
    const tp    = +(entry * 1.01).toFixed(2);    // TP 1.0% arriba
    const rr    = +((tp - entry) / (entry - sl)).toFixed(2);
    const risk  = equity * 0.005;                // 0.5% del equity
    const size  = +(risk / (entry - sl)).toFixed(4);

    return {
      pass: true,
      symbol: 'BTCUSDT',
      side:   'LONG',
      entry,
      sl,
      tp,
      size,
      rr,
      riskUSD: +risk.toFixed(2),
    };
  },
};`;

  const selStratObj = (strategies || []).find(s => s.id === selStrat);
  const sc = stratCode[selStrat] || { code: '', instructions: '', mode: 'instructions' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: T.surf3, border: `1px solid ${T.bdr2}`, borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            background: tab === t.id ? T.surf : 'transparent',
            color: tab === t.id ? T.txt : T.mutHi,
            border: `1px solid ${tab === t.id ? T.bdr2 : 'transparent'}`,
            transition: 'all 0.15s',
          }}>{t.label}</div>
        ))}
      </div>

      {/* TAB: Sistema */}
      {tab === 'sistema' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card pad={16}>
              <Label>Módulos del Sistema</Label>
              {[
                { key: 'visualAI', label: 'Validación Visual IA', desc: 'Filtro final antes de cada orden' },
                { key: 'monteCarlo', label: 'Monte Carlo', desc: '1000 iteraciones por backtest' },
                { key: 'telegram', label: 'Notificaciones Telegram', desc: 'Entry/exit/P&L/heartbeat' },
                { key: 'paperMode', label: 'Modo Paper', desc: 'Simulador con slippage + fees', warn: 'Desactivar para capital real' },
              ].map(m => (
                <div key={m.key} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.txt }}>{m.label}</span>
                    <Toggle checked={modules[m.key]} onChange={v => setModules(prev => ({ ...prev, [m.key]: v }))} />
                  </div>
                  <div style={{ fontSize: 11, color: T.mut }}>{m.desc}</div>
                  {m.warn && !modules[m.key] && <div style={{ fontSize: 11, color: T.yel, marginTop: 2 }}>⚠ {m.warn}</div>}
                </div>
              ))}
            </Card>
            <Card pad={16}>
              <Label>Reglas Innegociables</Label>
              {['Solo BTC y ETH futuros', 'Solo ventanas COT activas', 'Validación visual obligatoria', 'Max 2% riesgo/trade', 'DD diario >5% → STOP', 'R:R mínimo 2.0'].map(r => (
                <div key={r} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: T.acc, fontSize: 11 }}>■</span>
                  <span style={{ fontSize: 12, color: T.mutHi, lineHeight: 1.4 }}>{r}</span>
                </div>
              ))}
            </Card>
          </div>
          <Card pad={16}>
            <Label>Estado de Módulos</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[['visualAI','Visual AI','🤖'],['monteCarlo','Monte Carlo','🎲'],['telegram','Telegram','📨'],['paperMode','Paper Mode','📋']].map(([k,l,ic]) => (
                <div key={k} style={{ background: T.surf3, border: `1px solid ${modules[k] ? T.grn+'44' : T.bdr2}`, borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 20 }}>{ic}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.txt, marginBottom: 4 }}>{l}</div>
                    <Pill color={modules[k] ? 'grn' : 'mut'}>{modules[k] ? 'ACTIVO' : 'INACTIVO'}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB: Estrategias */}
      {tab === 'estrategias' && (
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(strategies || []).map(s => (
              <div key={s.id} onClick={() => setSelStrat(s.id)} style={{
                background: selStrat === s.id ? T.surf2 : T.surf,
                border: `1px solid ${selStrat === s.id ? s.color+'66' : T.bdr}`,
                borderRadius: 8, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, boxShadow: s.active ? `0 0 5px ${s.color}` : 'none' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.txt, flex: 1 }}>{s.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Pill color={s.active ? 'grn' : 'mut'}>{s.active ? 'ACTIVA' : 'INACTIVA'}</Pill>
                  {stratCode[s.id]?.code && <Pill color="acc">código</Pill>}
                  {stratCode[s.id]?.instructions && <Pill color="pur">instruc.</Pill>}
                </div>
              </div>
            ))}
            {(!strategies || strategies.length === 0) && (
              <div style={{ fontSize: 12, color: T.mut, padding: 20, textAlign: 'center' }}>Crea estrategias en la sección Estrategias</div>
            )}
          </div>

          {selStratObj ? (
            <Card pad={16} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: selStratObj.color }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: T.txt }}>{selStratObj.name}</span>
                  <Pill color={selStratObj.active ? 'grn' : 'mut'}>{selStratObj.active ? 'ACTIVA' : 'INACTIVA'}</Pill>
                  {engineStrategy.loaded && <Pill color="grn">⚙ En motor: {engineStrategy.name || 'activa'}</Pill>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {sc.loading && <span style={{ fontSize: 11, color: T.mut }}>Cargando...</span>}
                  {sc.loadError && <span style={{ fontSize: 11, color: T.red }}>✗ {sc.loadError}</span>}
                  {sc.savedAt && !sc.loadError && <span style={{ fontSize: 11, color: T.grn }}>✓ Guardado {sc.savedAt}</span>}
                  <Btn variant="accent" small disabled={sc.loading} onClick={() => handleSaveStrat(selStrat)}>Guardar código</Btn>
                </div>
              </div>

              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 2, marginBottom: 14, background: T.surf3, border: `1px solid ${T.bdr2}`, borderRadius: 6, padding: 3, width: 'fit-content' }}>
                {[['instructions','📝 Instrucciones'],['code','⚙ Código JS'],['both','◈ Ambos']].map(([id, label]) => (
                  <div key={id} onClick={() => updateSC(selStrat, { mode: id })} style={{
                    padding: '5px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                    fontWeight: sc.mode === id ? 600 : 400,
                    background: sc.mode === id ? T.surf : 'transparent',
                    color: sc.mode === id ? T.txt : T.mut, transition: 'all 0.12s',
                  }}>{label}</div>
                ))}
              </div>

              {/* Instructions */}
              {(sc.mode === 'instructions' || sc.mode === 'both') && (
                <div style={{ marginBottom: sc.mode === 'both' ? 14 : 0 }}>
                  <Label>Instrucciones en lenguaje natural</Label>
                  <textarea value={sc.instructions} onChange={e => updateSC(selStrat, { instructions: e.target.value })}
                    placeholder={`Ej: Esta estrategia opera BTCUSDT en Londres.\nEntrar LONG cuando:\n- FVG de 4H roto hacia arriba\n- RSI(14) < 60\n- Volumen > 1.5x promedio 20 velas`}
                    style={{ width: '100%', minHeight: sc.mode === 'both' ? 130 : 260, background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, padding: '12px 14px', resize: 'vertical', outline: 'none' }}
                  />
                </div>
              )}

              {/* Code */}
              {(sc.mode === 'code' || sc.mode === 'both') && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Label style={{ marginBottom: 0 }}>Código JavaScript</Label>
                    <Btn variant="ghost" small onClick={() => updateSC(selStrat, { code: TEMPLATE_BASE })}>Plantilla base</Btn>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 36, background: T.surf3, borderRadius: '6px 0 0 6px', borderRight: `1px solid ${T.bdr2}`, padding: '12px 0', pointerEvents: 'none', zIndex: 1, overflow: 'hidden' }}>
                      {(sc.code || '').split('\n').map((_, i) => (
                        <div key={i} style={{ fontSize: 10, color: T.mut, textAlign: 'right', paddingRight: 6, fontFamily: "'JetBrains Mono', monospace", lineHeight: '20px' }}>{i+1}</div>
                      ))}
                    </div>
                    <textarea value={sc.code} onChange={e => updateSC(selStrat, { code: e.target.value })}
                      spellCheck={false}
                      placeholder="// Pega o escribe tu estrategia aquí.\n// Debe exportar evaluate(data) via module.exports.\n// Usa el botón 'Plantilla base' para ver el formato."
                      style={{ width: '100%', minHeight: 400, background: T.bg, border: `1px solid ${sc.loadError ? T.red : T.bdr2}`, borderRadius: 6, color: '#a8d8a8', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, lineHeight: '20px', padding: '12px 12px 12px 44px', resize: 'vertical', outline: 'none', tabSize: 2 }}
                    />
                  </div>
                  <div style={{ fontSize: 11, color: T.mut, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span>El código debe exportar <Mono style={{ color: T.acc, fontSize: 11 }}>module.exports = {'{ name, evaluate(data) { ... } }'}</Mono></span>
                    <span>{(sc.code || '').split('\n').length} líneas</span>
                  </div>
                </div>
              )}
            </Card>
          ) : (
            <Card pad={40} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: T.mut }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⚙</div>
                <div style={{ fontSize: 14 }}>Selecciona una estrategia para editar su lógica</div>
              </div>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}

// ─── API KEYS SECTION — helper components (module-level to avoid remounts) ──
function ApisStatusBadge({ tested, k }) {
  if (tested[k] === 'testing') return <Pill color="acc">Probando...</Pill>;
  if (tested[k] === 'ok')      return <Pill color="grn">✓ Conectado</Pill>;
  if (tested[k] === 'fail')    return <Pill color="red">✗ Error</Pill>;
  return null;
}
function ApisSectionCard({ tested, onTest, icon, title, testKey, children }) {
  const T = window.T;
  return (
    <Card pad={20} style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: T.surf3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: T.txt }}>{title}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ApisStatusBadge tested={tested} k={testKey} />
          <Btn variant="ghost" small onClick={() => onTest(testKey)}>Probar conexión</Btn>
        </div>
      </div>
      {children}
    </Card>
  );
}
function ApisKeyInput({ vals, show, onSet, onToggle, label, field, placeholder, type = 'password' }) {
  const T = window.T;
  return (
    <div style={{ marginBottom: 12 }}>
      <Label style={{ marginBottom: 5 }}>{label}</Label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type={show[field] ? 'text' : type}
          value={vals[field] || ''}
          onChange={e => onSet(field, e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 12px', outline: 'none' }}
        />
        {type === 'password' && <Btn variant="ghost" small onClick={() => onToggle(field)}>{show[field] ? '🙈' : '👁'}</Btn>}
      </div>
    </div>
  );
}
function ApisSelectRow({ vals, onSet, label, field, options }) {
  const T = window.T;
  return (
    <div style={{ marginBottom: 12 }}>
      <Label style={{ marginBottom: 5 }}>{label}</Label>
      <select value={vals[field]} onChange={e => onSet(field, e.target.value)}
        style={{ width: '100%', background: T.surf3, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13, padding: '8px 12px', outline: 'none', cursor: 'pointer' }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─── API KEYS SECTION ──────────────────────────────────────────────────────
function APIsSection({ prices = {}, onPricesUpdate }) {
  const T = window.T;
  const [show, setShow] = useState({});
  const [vals, setVals] = useState(() => {
    try { return JSON.parse(localStorage.getItem('s9_apis') || 'null') || {
      brokerType: 'Binance', brokerKey: '', brokerSecret: '', brokerTestnet: true,
      aiType: 'Claude (Anthropic)', aiKey: '', aiModel: 'claude-haiku-4-5',
      tgToken: '', tgChatId: '',
      chartType: 'TradingView', chartKey: '', chartSession: '',
      webhookIn: 'http://127.0.0.1:8080/webhook/tv',
    }; } catch { return {
      brokerType: 'Binance', brokerKey: '', brokerSecret: '', brokerTestnet: true,
      aiType: 'Claude (Anthropic)', aiKey: '', aiModel: 'claude-haiku-4-5',
      tgToken: '', tgChatId: '',
      chartType: 'TradingView', chartKey: '', chartSession: '',
      webhookIn: 'http://127.0.0.1:8080/webhook/tv',
    }; }
  });
  const [tested, setTested] = useState(function() {
    try { return JSON.parse(localStorage.getItem('s9_tested') || '{}'); } catch { return {}; }
  });
  const [testMsgs, setTestMsgs] = useState(function() {
    try { return JSON.parse(localStorage.getItem('s9_testMsgs') || '{}'); } catch { return {}; }
  });
  const [liveConnected, setLiveConnected] = useState(false);
  const [tgConnected, setTgConnected] = useState(false);
  const [tgMsg, setTgMsg] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  // Persist to localStorage whenever vals / tested / testMsgs change
  useEffect(function() { localStorage.setItem('s9_apis', JSON.stringify(vals)); }, [vals]);
  useEffect(function() { localStorage.setItem('s9_tested', JSON.stringify(tested)); }, [tested]);
  useEffect(function() { localStorage.setItem('s9_testMsgs', JSON.stringify(testMsgs)); }, [testMsgs]);

  // Restore liveConnected from persisted tested state on mount
  useEffect(function() {
    if (tested.broker === 'ok') setLiveConnected(true);
    if (tested.telegram === 'ok') setTgConnected(true);
  }, []);

  const toggle = k => setShow(p => ({ ...p, [k]: !p[k] }));
  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));

  const NAMES = { broker: 'Binance/Exchange', telegram: 'Telegram', ai: 'Agente IA', chart: 'Chart/Alertas' };

  const notifyTg = function(text) {
    var token  = vals.tgToken;
    var chatId = vals.tgChatId;
    if (!token || !chatId) return;
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, chatId: chatId, text: text }),
    });
  };

  const test = (k) => {
    var prevStatus = tested[k];
    setTested(p => ({ ...p, [k]: 'testing' }));
    setTestMsgs(p => ({ ...p, [k]: '' }));

    const endpointMap = { broker: '/api/test/broker', telegram: '/api/test/telegram', ai: '/api/test/ai', chart: '/api/test/chart' };
    const bodyMap = {
      broker:   { type: vals.brokerType, key: vals.brokerKey, secret: vals.brokerSecret, testnet: vals.brokerTestnet },
      telegram: { token: vals.tgToken, chatId: vals.tgChatId },
      ai:       { type: vals.aiType, key: vals.aiKey, model: vals.aiModel },
      chart:    { type: vals.chartType, key: vals.chartKey },
    };

    fetch(endpointMap[k], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyMap[k] || {}),
    })
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        var newStatus = data.ok ? 'ok' : 'fail';
        setTested(p => ({ ...p, [k]: newStatus }));
        setTestMsgs(p => ({ ...p, [k]: data.msg || '' }));

        // Notificar en Telegram cuando cambia el estado de conexión
        var name = NAMES[k] || k;
        if (prevStatus !== 'ok' && data.ok) {
          notifyTg('✅ <b>' + name + ' conectado</b>\n' + (data.msg || ''));
        } else if (prevStatus === 'ok' && !data.ok) {
          notifyTg('⚠️ <b>' + name + ' desconectado</b>\n' + (data.msg || ''));
        }

        if (k === 'broker' && data.ok) setLiveConnected(true);
        if (k === 'telegram' && data.ok) {
          setTgConnected(true);
          setTgMsg('✓ ' + (data.msg || 'Mensaje enviado — revisa tu chat de Telegram'));
          setTimeout(function() { setTgMsg(''); }, 7000);
        }
      })
      .catch(function(e) {
        var prevOk = prevStatus === 'ok';
        setTested(p => ({ ...p, [k]: 'fail' }));
        setTestMsgs(p => ({ ...p, [k]: 'Sin respuesta del servidor — reinicia con npm start' }));
        if (prevOk) notifyTg('⚠️ <b>' + (NAMES[k] || k) + ' desconectado</b>\nSin respuesta del servidor');
      });
  };

  const handleSave = () => {
    localStorage.setItem('s9_apis', JSON.stringify(vals));
    setSavedMsg('✓ Configuración guardada');
    setTimeout(() => setSavedMsg(''), 2000);
  };

  return (
    <div>
      {/* Live price ticker — solo visible cuando broker conectado */}
      {liveConnected && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {['BTCUSDT','ETHUSDT'].map(sym => {
              const p = prices[sym] || null;
              const chg = prices[sym === 'BTCUSDT' ? 'BTCChange' : 'ETHChange'] || 0.62;
              return (
                <Card key={sym} pad={14} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: sym === 'BTCUSDT' ? '#f7931a22' : '#627eea22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {sym === 'BTCUSDT' ? '₿' : 'Ξ'}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: T.mut, marginBottom: 2 }}>{sym}</div>
                    <Mono style={{ fontSize: 20, fontWeight: 800, color: p ? T.txt : T.mut }}>{p ? `$${p.toLocaleString()}` : '—'}</Mono>
                  </div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: chg >= 0 ? T.grn : T.red }}>{chg >= 0 ? '+' : ''}{chg.toFixed(2)}%</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.grn, animation: 'pulse-dot 1.5s infinite' }} />
                      <span style={{ fontSize: 10, color: T.grn }}>En vivo</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {/* Botón Desconectar broker */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" small
              style={{ color: T.red, borderColor: T.red + '44', fontSize: 11 }}
              onClick={() => {
                setLiveConnected(false);
                setTested(p => ({ ...p, broker: undefined }));
                notifyTg('⚠️ <b>Broker desconectado</b>\nLos precios en vivo han sido ocultados en el dashboard.');
              }}>
              ⏏ Desconectar broker
            </Btn>
          </div>
        </div>
      )}

      {tgMsg && (
        <div style={{ marginBottom: 14, padding: '12px 16px', background: '#0d2e1a', border: `1px solid ${T.grn}44`, borderRadius: 8, fontSize: 13, color: T.grn }}>{tgMsg}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        <div style={{ paddingRight: 8 }}>
          <ApisSectionCard tested={tested} onTest={test} icon="🏦" title="Broker / Exchange" testKey="broker">
            <ApisSelectRow vals={vals} onSet={set} label="Exchange" field="brokerType" options={['Binance', 'Bybit', 'OKX', 'BitMEX', 'Kraken', 'KuCoin']} />
            <ApisKeyInput vals={vals} show={show} onSet={set} onToggle={toggle} label="API Key" field="brokerKey" placeholder="Pegar API key..." />
            <ApisKeyInput vals={vals} show={show} onSet={set} onToggle={toggle} label="Secret Key" field="brokerSecret" placeholder="Pegar Secret key..." />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <div>
                <span style={{ fontSize: 13, color: T.txt }}>Testnet / Sandbox</span>
                <div style={{ fontSize: 11, color: T.mut }}>Usar testnet primero — sin capital real</div>
              </div>
              <Toggle checked={vals.brokerTestnet} onChange={v => set('brokerTestnet', v)} />
            </div>
            {vals.brokerTestnet && <div style={{ fontSize: 11, color: T.yel, marginTop: 8, padding: '8px 12px', background: '#2a1f00', borderRadius: 6 }}>⚠ Testnet activo — órdenes simuladas</div>}
            {tested.broker === 'ok'   && testMsgs.broker && <div style={{ fontSize: 11, color: T.grn,  marginTop: 8, padding: '8px 12px', background: '#0d2e1a',  borderRadius: 6 }}>✓ {testMsgs.broker}</div>}
            {tested.broker === 'fail' && testMsgs.broker && <div style={{ fontSize: 11, color: T.red,  marginTop: 8, padding: '8px 12px', background: '#2a0d13',  borderRadius: 6 }}>✗ {testMsgs.broker}</div>}
          </ApisSectionCard>

          <ApisSectionCard tested={tested} onTest={test} icon="🤖" title="Agente IA — Validación Visual" testKey="ai">
            <ApisSelectRow vals={vals} onSet={set} label="Proveedor" field="aiType" options={['Claude (Anthropic)', 'OpenAI GPT-4o', 'Gemini Pro Vision', 'Llama 3 (Local)']} />
            <ApisKeyInput vals={vals} show={show} onSet={set} onToggle={toggle} label="API Key" field="aiKey" placeholder="sk-ant-..." />
            <ApisSelectRow vals={vals} onSet={set} label="Modelo" field="aiModel" options={['claude-haiku-4-5', 'claude-opus-4-5', 'gpt-4o', 'gpt-4o-mini', 'gemini-1.5-pro']} />
            <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>Confianza mínima: 0.6 · Usado en validación visual antes de cada orden</div>
            {tested.ai === 'ok'   && testMsgs.ai && <div style={{ fontSize: 11, color: T.grn,  marginTop: 8, padding: '8px 12px', background: '#0d2e1a',  borderRadius: 6 }}>✓ {testMsgs.ai}</div>}
            {tested.ai === 'fail' && testMsgs.ai && <div style={{ fontSize: 11, color: T.red,  marginTop: 8, padding: '8px 12px', background: '#2a0d13',  borderRadius: 6 }}>✗ {testMsgs.ai}</div>}
          </ApisSectionCard>
        </div>

        <div style={{ paddingLeft: 8 }}>
          <ApisSectionCard tested={tested} onTest={test} icon="📨" title="Telegram — Notificaciones" testKey="telegram">
            <ApisKeyInput vals={vals} show={show} onSet={set} onToggle={toggle} label="Bot Token" field="tgToken" placeholder="123456789:ABC-..." />
            <ApisKeyInput vals={vals} show={show} onSet={set} onToggle={toggle} label="Chat ID" field="tgChatId" placeholder="-100123456789" type="text" />
            <div style={{ fontSize: 11, color: T.mut, marginBottom: 8 }}>Al conectar, el bot enviará "Conectado — S9-TRIPLEX activo" a tu chat</div>
            {tgConnected && (
              <div style={{ padding: '10px 12px', background: '#0d2e1a', border: `1px solid ${T.grn}44`, borderRadius: 6, fontSize: 12, color: T.grn }}>
                ✓ Telegram conectado — recibirás señales, entry/exit, P&L y heartbeat cada 4h
              </div>
            )}
          </ApisSectionCard>

          <ApisSectionCard tested={tested} onTest={test} icon="📊" title="Charting / Alertas Externas" testKey="chart">
            <ApisSelectRow vals={vals} onSet={set} label="Plataforma" field="chartType" options={['TradingView', 'MetaTrader 4', 'MetaTrader 5', 'NinjaTrader', 'Custom Webhook']} />
            <ApisKeyInput vals={vals} show={show} onSet={set} onToggle={toggle} label="Session Token / API Key" field="chartKey" placeholder="Pegar token..." />
            <div style={{ marginBottom: 12 }}>
              <Label style={{ marginBottom: 5 }}>Webhook URL (entrada de alertas)</Label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={vals.webhookIn} onChange={e => set('webhookIn', e.target.value)}
                  style={{ flex: 1, background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.acc, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 12px', outline: 'none' }} />
                <Btn variant="ghost" small onClick={() => navigator.clipboard?.writeText(vals.webhookIn)}>⎘ Copiar</Btn>
              </div>
            </div>
            {tested.chart === 'ok'   && testMsgs.chart && <div style={{ fontSize: 11, color: T.grn,  padding: '8px 12px', background: '#0d2e1a',  borderRadius: 6 }}>✓ {testMsgs.chart}</div>}
            {tested.chart === 'fail' && testMsgs.chart && <div style={{ fontSize: 11, color: T.red,  padding: '8px 12px', background: '#2a0d13',  borderRadius: 6 }}>✗ {testMsgs.chart}</div>}
          </ApisSectionCard>

          <Card pad={16}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Label style={{ marginBottom: 0 }}>Sistema</Label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {savedMsg && <span style={{ fontSize: 12, color: T.grn }}>{savedMsg}</span>}
                <Btn variant="accent" small onClick={handleSave}>Guardar todo</Btn>
              </div>
            </div>
            {[['GUI Local','http://127.0.0.1:8080', T.acc],['Runtime','Node.js ≥ 20 + Express 4.x', T.mutHi],['Config','.env + config/s9-rules.json', T.mutHi]].map(([l,v,c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: T.mut }}>{l}</span>
                <Mono style={{ color: c, fontSize: 11 }}>{v}</Mono>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── ESTRATEGIAS SECTION ─────────────────────────────────────────────────────
const STRATEGIES_DEFAULT = [];

const ALL_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'LINKUSDT', 'AAVEUSDT'];
const ALL_TF = ['1D', '4H', '1H', '30m', '15m', '5m', '3m', '1m'];
const ALL_TZ = ['America/Bogota', 'America/New_York', 'Europe/London', 'Asia/Tokyo', 'UTC'];

function StrategiasSection({ strategies, setStrategies }) {
  const T = window.T;
  const [selected, setSelected] = useState((strategies[0] || {}).id);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saved, setSaved] = useState(false);

  const sel = strategies.find(s => s.id === selected);

  const update = (id, patch) => setStrategies(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  const toggleSymbol = (id, sym) => {
    const s = strategies.find(x => x.id === id);
    const next = s.symbols.includes(sym) ? s.symbols.filter(x => x !== sym) : [...s.symbols, sym];
    update(id, { symbols: next });
  };
  const toggleTF = (id, tf) => {
    const s = strategies.find(x => x.id === id);
    const next = s.tf.includes(tf) ? s.tf.filter(x => x !== tf) : [...s.tf, tf];
    update(id, { tf: next });
  };
  const addStrategy = () => {
    if (!newName.trim()) return;
    const id = Date.now();
    setStrategies(prev => [...prev, {
      id, name: newName.trim(), active: false,
      description: '', symbols: ['BTCUSDT'], tf: ['1H','15m'],
      windows: [{ id: 1, start: '08:30', end: '10:30', tz: 'America/Bogota', label: '' }],
      riskPct: 1.0, rrMin: 2.0, color: '#f0b429', trades: 0, wr: 0,
    }]);
    setSelected(id);
    setAdding(false);
    setNewName('');
  };
  const deleteStrategy = (id) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
    setSelected(strategies.find(s => s.id !== id)?.id || null);
  };
  const [saveErr, setSaveErr] = useState('');
  const handleSave = () => {
    setSaved(false);
    setSaveErr('');
    fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(strategies),
    })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.ok) { setSaved(true); setTimeout(function() { setSaved(false); }, 1800); }
        else { setSaveErr(d.error || 'Error al guardar'); }
      })
      .catch(function() { setSaveErr('Sin respuesta del servidor'); });
  };

  const COLORS = ['#4f8ef7','#22c97a','#f05168','#f0b429','#a78bfa','#38bdf8','#fb923c'];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, height: '100%' }}>
      {/* LEFT — strategy list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Add button */}
        {adding ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addStrategy(); if (e.key === 'Escape') setAdding(false); }}
              placeholder="Nombre de estrategia..."
              style={{ flex: 1, background: T.bg, border: `1px solid ${T.acc}`, borderRadius: 6, color: T.txt, fontSize: 13, padding: '8px 12px', outline: 'none', fontFamily: 'inherit' }}
            />
            <Btn variant="accent" small onClick={addStrategy}>OK</Btn>
            <Btn variant="ghost" small onClick={() => setAdding(false)}>✕</Btn>
          </div>
        ) : (
          <Btn variant="accent" onClick={() => setAdding(true)} style={{ width: '100%' }}>+ Nueva Estrategia</Btn>
        )}

        {/* Strategy cards */}
        {strategies.map(s => (
          <div key={s.id} onClick={() => setSelected(s.id)} style={{
            background: selected === s.id ? T.surf2 : T.surf,
            border: `1px solid ${selected === s.id ? s.color + '66' : T.bdr}`,
            borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
            transition: 'all 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, boxShadow: s.active ? `0 0 6px ${s.color}` : 'none', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: T.txt, flex: 1, lineHeight: 1.3 }}>{s.name}</span>
              <Toggle checked={s.active} onChange={v => update(s.id, { active: v })} />
            </div>
            <div style={{ fontSize: 11, color: T.mut, lineHeight: 1.4, marginBottom: 8 }}>{s.description || 'Sin descripción'}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Pill color={s.active ? 'grn' : 'mut'}>{s.active ? 'ACTIVA' : 'INACTIVA'}</Pill>
              {(s.windows || []).slice(0,2).map((w,i) => (
                <span key={i} style={{ fontSize: 10, color: T.mut, alignSelf: 'center' }}>{w.start}–{w.end}</span>
              ))}
              {(s.windows || []).length > 2 && <span style={{ fontSize: 10, color: T.mut }}>+{s.windows.length - 2}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT — editor */}
      {sel ? (
        <Card pad={20} style={{ overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: sel.color }} />
                <span style={{ fontSize: 18, fontWeight: 700, color: T.txt }}>{sel.name}</span>
                <Pill color={sel.active ? 'grn' : 'mut'}>{sel.active ? 'ACTIVA' : 'INACTIVA'}</Pill>
              </div>
              {sel.trades > 0 && (
                <div style={{ fontSize: 12, color: T.mut }}>{sel.trades} trades · WR {sel.wr}%</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {saved && <span style={{ fontSize: 12, color: T.grn }}>✓ Guardado en servidor</span>}
              {saveErr && <span style={{ fontSize: 12, color: T.red }}>{saveErr}</span>}
              <Btn variant="danger" small onClick={() => deleteStrategy(sel.id)}>Eliminar</Btn>
              <Btn variant="accent" onClick={handleSave}>Guardar en servidor</Btn>
            </div>
          </div>

          <Divider />

          {/* Activar / Desactivar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: sel.active ? '#0d2e1a' : T.surf3, border: `1px solid ${sel.active ? T.grn + '44' : T.bdr2}`, borderRadius: 8, padding: '14px 18px' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: sel.active ? T.grn : T.mutHi }}>Estrategia {sel.active ? 'ACTIVA' : 'INACTIVA'}</div>
                <div style={{ fontSize: 12, color: T.mut, marginTop: 3 }}>
                  {sel.active ? 'El motor buscará señales con esta estrategia durante la ventana definida' : 'No se generarán señales con esta estrategia'}
                </div>
              </div>
              <Toggle checked={sel.active} onChange={v => update(sel.id, { active: v })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: sel.executionMode === 'real' ? '#2a0d13' : T.surf3, border: `1px solid ${sel.executionMode === 'real' ? T.red + '44' : T.bdr2}`, borderRadius: 8, padding: '14px 18px', minWidth: 200 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: sel.executionMode === 'real' ? T.red : T.yel }}>
                  {sel.executionMode === 'real' ? '⚡ Modo REAL' : '📋 Modo PAPER'}
                </div>
                <div style={{ fontSize: 12, color: T.mut, marginTop: 3 }}>
                  {sel.executionMode === 'real' ? 'Órdenes reales en Binance' : 'Simulación sin capital real'}
                </div>
              </div>
              <Toggle checked={sel.executionMode === 'real'} onChange={v => {
                update(sel.id, { executionMode: v ? 'real' : 'paper' });
                fetch('/api/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: v ? 'LIVE' : 'PAPER' }) }).catch(() => {});
              }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Descripción */}
            <div style={{ gridColumn: '1/-1' }}>
              <Label>Descripción</Label>
              <textarea value={sel.description} onChange={e => update(sel.id, { description: e.target.value })} rows={2}
                style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13, padding: '10px 12px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} />
            </div>

            {/* Color */}
            <div>
              <Label>Color identificador</Label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <div key={c} onClick={() => update(sel.id, { color: c })} style={{ width: 28, height: 28, borderRadius: 6, background: c, cursor: 'pointer', border: `2px solid ${sel.color === c ? '#fff' : 'transparent'}`, transition: 'border 0.1s', boxShadow: sel.color === c ? `0 0 8px ${c}` : 'none' }} />
                ))}
              </div>
            </div>

            {/* Activos */}
            <div>
              <Label>Activos / Pares</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ALL_SYMBOLS.map(sym => (
                  <div key={sym} onClick={() => toggleSymbol(sel.id, sym)} style={{
                    fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
                    background: sel.symbols.includes(sym) ? `${sel.color}22` : T.surf3,
                    border: `1px solid ${sel.symbols.includes(sym) ? sel.color + '88' : T.bdr2}`,
                    color: sel.symbols.includes(sym) ? sel.color : T.mut,
                    transition: 'all 0.12s',
                  }}>{sym}</div>
                ))}
              </div>
            </div>

            {/* Timeframes */}
            <div>
              <Label>Timeframes de análisis</Label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ALL_TF.map(tf => (
                  <div key={tf} onClick={() => toggleTF(sel.id, tf)} style={{
                    fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
                    background: sel.tf.includes(tf) ? `${sel.color}22` : T.surf3,
                    border: `1px solid ${sel.tf.includes(tf) ? sel.color + '88' : T.bdr2}`,
                    color: sel.tf.includes(tf) ? sel.color : T.mut,
                    transition: 'all 0.12s',
                  }}>{tf}</div>
                ))}
              </div>
            </div>

            {/* Ventanas horarias — múltiples */}
            <div style={{ gridColumn: '1/-1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Label style={{ marginBottom: 0 }}>Ventanas Horarias de Operación</Label>
                <Btn variant="accent" small onClick={() => {
                  const wins = sel.windows || [];
                  const newWin = { id: Date.now(), start: '08:00', end: '10:00', tz: 'America/Bogota', label: '' };
                  update(sel.id, { windows: [...wins, newWin] });
                }}>+ Agregar ventana</Btn>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(sel.windows || []).map((win, idx) => {
                  const updateWin = (patch) => {
                    const updated = sel.windows.map(w => w.id === win.id ? { ...w, ...patch } : w);
                    update(sel.id, { windows: updated });
                  };
                  const removeWin = () => {
                    update(sel.id, { windows: sel.windows.filter(w => w.id !== win.id) });
                  };
                  const [sh, sm] = win.start.split(':').map(Number);
                  const [eh, em] = win.end.split(':').map(Number);
                  const durMins = (eh * 60 + em) - (sh * 60 + sm);
                  const durLabel = durMins > 0 ? `${Math.floor(durMins/60)}h ${durMins%60 > 0 ? durMins%60+'m' : ''}`.trim() : '—';

                  return (
                    <div key={win.id} style={{ background: T.surf3, border: `1px solid ${T.bdr2}`, borderRadius: 8, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        {/* Etiqueta */}
                        <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                          <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>ETIQUETA</div>
                          <input
                            type="text"
                            value={win.label}
                            onChange={e => updateWin({ label: e.target.value })}
                            placeholder={`Ventana ${idx + 1}`}
                            style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'inherit' }}
                          />
                        </div>
                        {/* Inicio */}
                        <div>
                          <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>INICIO</div>
                          <input type="time" value={win.start} onChange={e => updateWin({ start: e.target.value })}
                            style={{ background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 15, fontWeight: 700, padding: '7px 10px', outline: 'none', fontFamily: "'JetBrains Mono', monospace", colorScheme: 'dark' }} />
                        </div>
                        <div style={{ color: T.mut, fontSize: 18, paddingBottom: 8 }}>→</div>
                        {/* Fin */}
                        <div>
                          <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>FIN</div>
                          <input type="time" value={win.end} onChange={e => updateWin({ end: e.target.value })}
                            style={{ background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 15, fontWeight: 700, padding: '7px 10px', outline: 'none', fontFamily: "'JetBrains Mono', monospace", colorScheme: 'dark' }} />
                        </div>
                        {/* Zona horaria */}
                        <div style={{ flex: '1 1 160px', minWidth: 150 }}>
                          <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>ZONA HORARIA</div>
                          <select value={win.tz} onChange={e => updateWin({ tz: e.target.value })}
                            style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 12, padding: '8px 10px', outline: 'none', cursor: 'pointer' }}>
                            {ALL_TZ.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                          </select>
                        </div>
                        {/* Duración badge */}
                        <div style={{ textAlign: 'center', minWidth: 52 }}>
                          <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' }}>DURACIÓN</div>
                          <Mono style={{ fontSize: 14, fontWeight: 700, color: sel.color }}>{durLabel}</Mono>
                        </div>
                        {/* Eliminar */}
                        {sel.windows.length > 1 && (
                          <Btn variant="ghost" small onClick={removeWin} style={{ color: T.red, borderColor: T.red + '44', marginBottom: 1 }}>✕</Btn>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resumen total */}
              {(sel.windows || []).length > 1 && (
                <div style={{ marginTop: 8, fontSize: 12, color: T.mut, display: 'flex', gap: 16 }}>
                  <span>{sel.windows.length} ventanas activas</span>
                  <span style={{ color: sel.color }}>
                    Total: {(() => {
                      const total = (sel.windows || []).reduce((acc, w) => {
                        const [sh, sm] = w.start.split(':').map(Number);
                        const [eh, em] = w.end.split(':').map(Number);
                        const d = (eh * 60 + em) - (sh * 60 + sm);
                        return acc + (d > 0 ? d : 0);
                      }, 0);
                      return `${Math.floor(total/60)}h ${total%60 > 0 ? total%60+'m' : ''}`.trim();
                    })()} operativos/día
                  </span>
                </div>
              )}
            </div>

            {/* Risk params */}
            <div>
              <Label>Riesgo por Trade (%)</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="range" min="0.1" max="5" step="0.1" value={sel.riskPct} onChange={e => update(sel.id, { riskPct: parseFloat(e.target.value) })}
                  style={{ flex: 1, accentColor: sel.color }} />
                <Mono style={{ fontSize: 16, fontWeight: 700, color: sel.color, minWidth: 40 }}>{sel.riskPct.toFixed(1)}%</Mono>
              </div>
              <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>Recomendado: 0.5–2% para futuros</div>
            </div>

            <div>
              <Label>R:R Mínimo</Label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="range" min="1" max="5" step="0.5" value={sel.rrMin} onChange={e => update(sel.id, { rrMin: parseFloat(e.target.value) })}
                  style={{ flex: 1, accentColor: sel.color }} />
                <Mono style={{ fontSize: 16, fontWeight: 700, color: sel.color, minWidth: 40 }}>{sel.rrMin}R</Mono>
              </div>
              <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>S9-Triplex usa ≥ 2.0R innegociable</div>
            </div>
          </div>
        </Card>
      ) : (
        <Card pad={40} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: T.mut }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
            <div style={{ fontSize: 14 }}>Selecciona o crea una estrategia</div>
          </div>
        </Card>
      )}
    </div>
  );
}


// ─── ORDERS SECTION ─────────────────────────────────────────────────────────
function OrdersSection({ prices = {} }) {
  const T = window.T;
  const [orderType, setOrderType] = useState('market');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [side, setSide] = useState('BUY');
  const [qty, setQty] = useState('0.001');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailPct, setTrailPct] = useState('1.5');
  const [twapParts, setTwapParts] = useState('5');
  const [twapInterval, setTwapInterval] = useState('60');
  const [ladderStart, setLadderStart] = useState('');
  const [ladderEnd, setLadderEnd] = useState('');
  const [ladderSteps, setLadderSteps] = useState('5');
  const [slPrice, setSlPrice] = useState('');
  const [tpPrice, setTpPrice] = useState('');
  const [slMode, setSlMode] = useState('fijo');   // fijo | pct
  const [tpMode, setTpMode] = useState('fijo');   // fijo | pct
  const [slPct, setSlPct] = useState('2');
  const [tpPct, setTpPct] = useState('4');
  const [paperMode, setPaperMode] = useState(true);
  const [aiValidation, setAiValidation] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [submitErr, setSubmitErr] = useState('');
  const [orderHistory, setOrderHistory] = useLS('s9_orderHistory', []);

  const livePrice = prices[symbol] || null;

  const slEffective = slMode === 'pct' && parseFloat(slPct) > 0
    ? (side === 'BUY' ? livePrice * (1 - parseFloat(slPct) / 100) : livePrice * (1 + parseFloat(slPct) / 100)).toFixed(2)
    : (slPrice !== '' ? slPrice : null);
  const tpEffective = tpMode === 'pct' && parseFloat(tpPct) > 0
    ? (side === 'BUY' ? livePrice * (1 + parseFloat(tpPct) / 100) : livePrice * (1 - parseFloat(tpPct) / 100)).toFixed(2)
    : (tpPrice !== '' ? tpPrice : null);

  const ORDER_TYPES = [
    { id: 'market',     label: 'Market',     icon: '⚡', desc: 'Compra/venta instantánea al precio actual' },
    { id: 'limit',      label: 'Limit',      icon: '◎', desc: 'Fijar precio de ejecución exacto' },
    { id: 'postonly',   label: 'Post Only',  icon: '🏷', desc: 'Garantiza modo Maker — menores comisiones' },
    { id: 'stop',       label: 'Condicional',icon: '⚑', desc: 'Se activa al alcanzar un precio disparador' },
    { id: 'trailing',   label: 'Trailing Stop', icon: '↗', desc: 'Stop loss que sigue al precio a tu favor' },
    { id: 'twap',       label: 'TWAP',       icon: '⏱', desc: 'Divide órdenes grandes en intervalos de tiempo' },
    { id: 'ladder',     label: 'Escalonada', icon: '⊟', desc: 'Escalera de precios automática' },
  ];

  const handleSubmit = function() {
    const entryPrice = orderType === 'market' ? livePrice : (parseFloat(limitPrice) || livePrice);
    const ts = new Date().toLocaleTimeString('es-CO', { hour12: false });
    const order = {
      id: Date.now(), time: ts, type: orderType, symbol, side, qty: qty,
      price: entryPrice, mode: paperMode ? 'PAPER' : 'REAL', ai: aiValidation,
      status: 'ENVIADA',
    };
    setSubmitErr('');
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol, side, qty, orderType,
        price: entryPrice,
        sl: slEffective || undefined,
        tp: tpEffective || undefined,
      }),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.ok) {
          order.status = 'EJECUTADA';
          setOrderHistory(function(prev) { return [order, ...prev].slice(0, 50); });
          setSubmitted(order);
          setTimeout(function() { setSubmitted(null); }, 4000);
        } else {
          setSubmitErr(data.error || 'Error al enviar orden');
        }
      })
      .catch(function(e) {
        setSubmitErr('Sin respuesta del servidor');
      });
  };

  const ladderPrices = (() => {
    const s = parseFloat(ladderStart), e = parseFloat(ladderEnd), n = parseInt(ladderSteps);
    if (!s || !e || n < 2) return [];
    return Array.from({ length: n }, (_, i) => (s + (e - s) * i / (n - 1)).toFixed(2));
  })();

  const ot = ORDER_TYPES.find(o => o.id === orderType);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
      {/* Order form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Mode + AI toggles */}
        <div style={{ display: 'flex', gap: 12 }}>
          <Card pad={14} style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: paperMode ? T.yel : T.grn }}>
                  {paperMode ? '📋 Modo Paper' : '⚡ Modo Real'}
                </div>
                <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>
                  {paperMode ? 'Sin capital real — simulación' : '⚠ Operaciones reales con tu capital'}
                </div>
              </div>
              <Toggle checked={!paperMode} onChange={v => setPaperMode(!v)} />
            </div>
          </Card>
          <Card pad={14} style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: aiValidation ? T.acc : T.mutHi }}>
                  {aiValidation ? '🤖 Validación AI ON' : '🤖 Validación AI OFF'}
                </div>
                <div style={{ fontSize: 11, color: T.mut, marginTop: 2 }}>
                  {aiValidation ? 'Requiere aprobación Claude antes de ejecutar' : 'Ejecución directa sin filtro AI'}
                </div>
              </div>
              <Toggle checked={aiValidation} onChange={setAiValidation} />
            </div>
          </Card>
        </div>

        {/* Symbol + Side */}
        <Card pad={16}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <Label>Activo</Label>
              <div style={{ display: 'flex', gap: 6 }}>
                {['BTCUSDT', 'ETHUSDT'].map(s => (
                  <div key={s} onClick={() => setSymbol(s)} style={{
                    flex: 1, textAlign: 'center', padding: '9px', borderRadius: 6, cursor: 'pointer',
                    background: symbol === s ? (s === 'BTCUSDT' ? '#f7931a22' : '#627eea22') : T.surf3,
                    border: `1px solid ${symbol === s ? (s === 'BTCUSDT' ? '#f7931a88' : '#627eea88') : T.bdr2}`,
                    color: symbol === s ? (s === 'BTCUSDT' ? '#f7931a' : '#627eea') : T.mutHi,
                    fontSize: 13, fontWeight: 600, transition: 'all 0.12s',
                  }}>{s === 'BTCUSDT' ? '₿ BTC' : 'Ξ ETH'}</div>
                ))}
              </div>
            </div>
            <div>
              <Label>Precio actual</Label>
              <div style={{ background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Mono style={{ fontSize: 16, fontWeight: 700, color: livePrice ? T.txt : T.mut }}>{livePrice ? `$${livePrice.toLocaleString()}` : '—'}</Mono>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.grn, animation: 'pulse-dot 2s infinite' }} />
              </div>
            </div>
          </div>

          {/* BUY / SELL */}
          <Label>Dirección</Label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['BUY','SELL'].map(s => (
              <div key={s} onClick={() => setSide(s)} style={{
                flex: 1, textAlign: 'center', padding: '10px', borderRadius: 6, cursor: 'pointer',
                background: side === s ? (s === 'BUY' ? '#0d2e1a' : '#2a0d13') : T.surf3,
                border: `1px solid ${side === s ? (s === 'BUY' ? T.grn : T.red) : T.bdr2}`,
                color: side === s ? (s === 'BUY' ? T.grn : T.red) : T.mutHi,
                fontSize: 14, fontWeight: 700, transition: 'all 0.12s',
              }}>{s === 'BUY' ? '▲ COMPRAR' : '▼ VENDER'}</div>
            ))}
          </div>

          {/* Quantity */}
          <Label>Cantidad ({symbol})</Label>
          <input type="number" value={qty} onChange={e => setQty(e.target.value)} min="0.001" step="0.001"
            style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '9px 12px', outline: 'none', marginBottom: 4 }} />
          <div style={{ fontSize: 11, color: T.mut, marginBottom: 14 }}>
            ≈ ${(parseFloat(qty) * livePrice).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD
          </div>

          {/* SL / TP */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Label style={{ color: T.red, marginBottom: 0 }}>Stop Loss</Label>
                <div style={{ display: 'flex', gap: 2 }}>
                  {['fijo', 'pct'].map(function(m) { return (
                    <div key={m} onClick={function() { setSlMode(m); }} style={{
                      padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                      background: slMode === m ? T.red + '33' : T.surf3,
                      color: slMode === m ? T.red : T.mut, border: `1px solid ${slMode === m ? T.red + '66' : T.bdr2}`,
                    }}>{m === 'fijo' ? 'Fijo' : '%'}</div>
                  ); })}
                </div>
              </div>
              {slMode === 'fijo'
                ? <input type="number" value={slPrice} onChange={function(e) { setSlPrice(e.target.value); }}
                    placeholder="Opcional"
                    style={{ width: '100%', background: T.bg, border: `1px solid ${T.red}55`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: '8px 10px', outline: 'none' }} />
                : <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" value={slPct} onChange={function(e) { setSlPct(e.target.value); }} min="0.1" max="20" step="0.1"
                      style={{ width: '70px', background: T.bg, border: `1px solid ${T.red}55`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: '8px 10px', outline: 'none' }} />
                    <span style={{ fontSize: 12, color: T.mut }}>% → </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: T.red }}>${parseFloat(slEffective).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                  </div>
              }
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Label style={{ color: T.grn, marginBottom: 0 }}>Take Profit</Label>
                <div style={{ display: 'flex', gap: 2 }}>
                  {['fijo', 'pct'].map(function(m) { return (
                    <div key={m} onClick={function() { setTpMode(m); }} style={{
                      padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                      background: tpMode === m ? T.grn + '33' : T.surf3,
                      color: tpMode === m ? T.grn : T.mut, border: `1px solid ${tpMode === m ? T.grn + '66' : T.bdr2}`,
                    }}>{m === 'fijo' ? 'Fijo' : '%'}</div>
                  ); })}
                </div>
              </div>
              {tpMode === 'fijo'
                ? <input type="number" value={tpPrice} onChange={function(e) { setTpPrice(e.target.value); }}
                    placeholder="Opcional"
                    style={{ width: '100%', background: T.bg, border: `1px solid ${T.grn}55`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: '8px 10px', outline: 'none' }} />
                : <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" value={tpPct} onChange={function(e) { setTpPct(e.target.value); }} min="0.1" max="50" step="0.1"
                      style={{ width: '70px', background: T.bg, border: `1px solid ${T.grn}55`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, padding: '8px 10px', outline: 'none' }} />
                    <span style={{ fontSize: 12, color: T.mut }}>% → </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: T.grn }}>${parseFloat(tpEffective).toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                  </div>
              }
            </div>
          </div>
          {slEffective && tpEffective && parseFloat(slEffective) > 0 && parseFloat(tpEffective) > 0 && Math.abs(livePrice - parseFloat(slEffective)) > 0 && (
            <div style={{ fontSize: 11, color: T.mut, marginTop: 4, marginBottom: 6 }}>
              R:R <span style={{ color: T.acc, fontWeight: 700 }}>
                {(Math.abs(parseFloat(tpEffective) - livePrice) / Math.abs(livePrice - parseFloat(slEffective))).toFixed(2)}R
              </span>
            </div>
          )}
        </Card>

        {/* Order type selector */}
        <Card pad={16}>
          <Label>Tipo de Orden</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 16 }}>
            {ORDER_TYPES.map(o => (
              <div key={o.id} onClick={() => setOrderType(o.id)} style={{
                padding: '10px 8px', borderRadius: 7, cursor: 'pointer', textAlign: 'center',
                background: orderType === o.id ? `${T.acc}18` : T.surf3,
                border: `1px solid ${orderType === o.id ? T.acc+'66' : T.bdr2}`,
                transition: 'all 0.12s',
              }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{o.icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: orderType === o.id ? T.acc : T.mutHi }}>{o.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: T.mutHi, marginBottom: 16 }}>{ot?.desc}</div>

          {/* Order-specific inputs */}
          {(orderType === 'limit' || orderType === 'postonly') && (
            <div style={{ marginBottom: 12 }}>
              <Label>Precio límite</Label>
              <input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} placeholder={livePrice != null ? livePrice.toString() : ''}
                style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '9px 12px', outline: 'none' }} />
            </div>
          )}
          {orderType === 'stop' && (
            <div style={{ marginBottom: 12 }}>
              <Label>Precio disparador</Label>
              <input type="number" value={stopPrice} onChange={e => setStopPrice(e.target.value)} placeholder={livePrice != null ? livePrice.toString() : ''}
                style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '9px 12px', outline: 'none' }} />
            </div>
          )}
          {orderType === 'trailing' && (
            <div style={{ marginBottom: 12 }}>
              <Label>Trailing (%)</Label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="range" min="0.1" max="10" step="0.1" value={trailPct} onChange={e => setTrailPct(e.target.value)} style={{ flex: 1, accentColor: T.acc }} />
                <Mono style={{ color: T.acc, fontWeight: 700, fontSize: 16, minWidth: 44 }}>{trailPct}%</Mono>
              </div>
              <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>Stop se moverá {trailPct}% detrás del precio máximo</div>
            </div>
          )}
          {orderType === 'twap' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <Label>Número de partes</Label>
                <input type="number" value={twapParts} onChange={e => setTwapParts(e.target.value)} min="2" max="20"
                  style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '9px 12px', outline: 'none' }} />
              </div>
              <div>
                <Label>Intervalo (segundos)</Label>
                <input type="number" value={twapInterval} onChange={e => setTwapInterval(e.target.value)} min="5"
                  style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 14, padding: '9px 12px', outline: 'none' }} />
              </div>
              <div style={{ gridColumn: '1/-1', fontSize: 12, color: T.mutHi }}>
                {twapParts} órdenes de {(parseFloat(qty)/parseInt(twapParts)).toFixed(4)} {symbol} · cada {twapInterval}s · duración total: {(parseInt(twapParts)*parseInt(twapInterval)/60).toFixed(1)} min
              </div>
            </div>
          )}
          {orderType === 'ladder' && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div><Label>Precio inicio</Label>
                  <input type="number" value={ladderStart} onChange={e => setLadderStart(e.target.value)} placeholder="94000"
                    style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 10px', outline: 'none' }} /></div>
                <div><Label>Precio fin</Label>
                  <input type="number" value={ladderEnd} onChange={e => setLadderEnd(e.target.value)} placeholder="95000"
                    style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 10px', outline: 'none' }} /></div>
                <div><Label>Escalones</Label>
                  <input type="number" value={ladderSteps} onChange={e => setLadderSteps(e.target.value)} min="2" max="20"
                    style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '8px 10px', outline: 'none' }} /></div>
              </div>
              {ladderPrices.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ladderPrices.map((p, i) => (
                    <div key={i} style={{ background: T.surf3, border: `1px solid ${T.bdr2}`, borderRadius: 4, padding: '4px 10px' }}>
                      <Mono style={{ fontSize: 11, color: T.acc }}>${p}</Mono>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <Btn variant={side === 'BUY' ? 'grn' : 'danger'} onClick={handleSubmit}
            style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 700, marginTop: 4 }}>
            {aiValidation ? '🤖 Enviar a validación AI' : paperMode ? '📋 Ejecutar en Paper' : `⚡ ${side} ${qty} ${symbol.replace('USDT','')} — REAL`}
          </Btn>
          {submitted && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: '#0d2e1a', border: `1px solid ${T.grn}44`, borderRadius: 6, fontSize: 12, color: T.grn }}>
              ✓ {submitted.side} {submitted.qty} {submitted.symbol} @${submitted.price.toLocaleString()} — {submitted.mode} · {submitted.time}
            </div>
          )}
          {submitErr && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: '#2a0d13', border: `1px solid ${T.red}44`, borderRadius: 6, fontSize: 12, color: T.red }}>
              ✗ {submitErr}
            </div>
          )}
        </Card>
      </div>

      {/* Order history */}
      <Card pad={0} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.bdr}` }}>
          <Label style={{ marginBottom: 0 }}>Historial de Órdenes ({orderHistory.length})</Label>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {orderHistory.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', color: T.mut, fontSize: 12 }}>Sin órdenes en esta sesión</div>
          )}
          {orderHistory.map(o => (
            <div key={o.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${T.bdr}`, animation: 'slide-in 0.2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Pill color={o.side === 'BUY' ? 'grn' : 'red'}>{o.side}</Pill>
                  <Mono style={{ fontSize: 12, fontWeight: 700 }}>{o.symbol}</Mono>
                  <span style={{ fontSize: 11, color: T.mut }}>{o.type}</span>
                </div>
                <Mono style={{ fontSize: 10, color: T.mut }}>{o.time}</Mono>
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                <span style={{ color: T.mutHi }}>Qty: <Mono style={{ color: T.txt }}>{o.qty}</Mono></span>
                <span style={{ color: T.mutHi }}>@ <Mono style={{ color: T.txt }}>${o.price.toLocaleString()}</Mono></span>
                <Pill color={o.mode === 'PAPER' ? 'yel' : 'red'}>{o.mode}</Pill>
                {o.ai && <Pill color="acc">AI</Pill>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── DEPLOY SECTION ──────────────────────────────────────────────────────────
function DeploySection() {
  const T = window.T;
  const [tab, setTab] = useState('server');
  const [serverProv, setServerProv] = useState('railway');
  const [gitVals, setGitVals] = useState({ repoUrl: '', token: '', branch: 'main', commitMsg: 'chore: update S9-Triplex config' });
  const [gitStatus, setGitStatus] = useState(null);
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState(null);
  const [deployLog, setDeployLog] = useState([]);
  const [showToken, setShowToken] = useState(false);

  const setGit = (k, v) => setGitVals(p => ({ ...p, [k]: v }));

  const [customServers, setCustomServers] = useState(() => {
    try { return JSON.parse(localStorage.getItem('s9_custom_servers') || '[]'); } catch { return []; }
  });
  const [addingCustom, setAddingCustom] = useState(false);
  const [newServer, setNewServer] = useState({ name: '', url: '', notes: '' });

  const addCustomServer = () => {
    if (!newServer.name.trim()) return;
    const srv = { id: 'custom_' + Date.now(), ...newServer, icon: '🖥', badge: 'PERSONALIZADO', badgeColor: 'pur', price: 'Tu servidor', steps: ['Conecta vía SSH a tu servidor', 'git clone tu-repo && npm install', 'cp .env.example .env && nano .env', 'npm install -g pm2', 'pm2 start npm -- start && pm2 save'], envVars: ['BINANCE_API_KEY', 'BINANCE_SECRET', 'TELEGRAM_TOKEN', 'CLAUDE_API_KEY'], desc: newServer.notes || 'Servidor personalizado', url: newServer.url };
    const updated = [...customServers, srv];
    setCustomServers(updated);
    localStorage.setItem('s9_custom_servers', JSON.stringify(updated));
    setNewServer({ name: '', url: '', notes: '' });
    setAddingCustom(false);
    setServerProv(srv.id);
  };

  const removeCustomServer = (id) => {
    const updated = customServers.filter(s => s.id !== id);
    setCustomServers(updated);
    localStorage.setItem('s9_custom_servers', JSON.stringify(updated));
    if (serverProv === id) setServerProv('railway');
  };

  const SERVERS = [
    {
      id: 'railway',
      name: 'Railway',
      icon: '🚂',
      desc: 'Deploy con 1 clic. $5/mes. Ideal para bots.',
      badge: 'RECOMENDADO',
      badgeColor: 'grn',
      steps: [
        'Sube tu código a GitHub (tab Git)',
        'Ve a railway.app → New Project → Deploy from GitHub',
        'Selecciona tu repo S9-Triplex',
        'Agrega variables de entorno (API keys)',
        'Railway asigna URL pública automáticamente',
        'El bot corre 24/7 — recibe alertas por webhook',
      ],
      envVars: ['BINANCE_API_KEY', 'BINANCE_SECRET', 'TELEGRAM_TOKEN', 'CLAUDE_API_KEY', 'PORT=8080'],
      url: 'https://railway.app',
      price: '$5/mes · 512MB RAM',
    },
    {
      id: 'render',
      name: 'Render',
      icon: '▲',
      desc: 'Free tier disponible. Auto-deploy desde GitHub.',
      badge: 'FREE TIER',
      badgeColor: 'acc',
      steps: [
        'Conecta repo GitHub en render.com',
        'Nuevo "Web Service" → selecciona repo',
        'Build Command: npm install',
        'Start Command: npm start',
        'Agrega variables de entorno en el panel',
        'Activa "Auto-Deploy" para push automático',
      ],
      envVars: ['BINANCE_API_KEY', 'BINANCE_SECRET', 'TELEGRAM_TOKEN', 'CLAUDE_API_KEY'],
      url: 'https://render.com',
      price: 'Free / $7 mes · 512MB RAM',
    },
    {
      id: 'flyio',
      name: 'Fly.io',
      icon: '🪁',
      desc: 'Contenedores globales. Baja latencia en NY/LDN.',
      badge: 'BAJA LATENCIA',
      badgeColor: 'pur',
      steps: [
        'Instala flyctl: curl -L https://fly.io/install.sh | sh',
        'fly auth login',
        'En carpeta del proyecto: fly launch',
        'Configura fly.toml (región: ewr para NY, lhr para LDN)',
        'fly secrets set BINANCE_API_KEY=xxx ...',
        'fly deploy → online en ~2 minutos',
      ],
      envVars: ['BINANCE_API_KEY', 'BINANCE_SECRET', 'TELEGRAM_TOKEN', 'CLAUDE_API_KEY'],
      url: 'https://fly.io',
      price: '$1.94/mes · shared-cpu-1x',
    },
    {
      id: 'vps',
      name: 'VPS (Hetzner / DO)',
      icon: '🖥',
      desc: 'Servidor dedicado. Máximo control. Desde €4/mes.',
      badge: 'MÁXIMO CONTROL',
      badgeColor: 'yel',
      steps: [
        'Crea VPS Ubuntu 22.04 en hetzner.com o digitalocean.com',
        'ssh root@IP → apt update && apt install nodejs npm git -y',
        'git clone tu-repo && cd S9-Triplex && npm install',
        'Crea archivo .env con tus API keys',
        'Instala PM2: npm install -g pm2',
        'pm2 start npm -- start && pm2 save && pm2 startup',
      ],
      envVars: ['BINANCE_API_KEY', 'BINANCE_SECRET', 'TELEGRAM_TOKEN', 'CLAUDE_API_KEY', 'NODE_ENV=production'],
      url: 'https://hetzner.com',
      price: '€4.35/mes · 2vCPU 2GB RAM',
    },
  ];

  const allServers = [...SERVERS, ...customServers];
  const selServer = allServers.find(s => s.id === serverProv) || SERVERS[0];

  const handleDeploy = () => {
    setDeploying(true);
    setDeployStatus('deploying');
    setDeployLog([]);
    const msgs = [
      'Conectando con ' + selServer.name + '...',
      'Validando credenciales...',
      'Subiendo archivos del proyecto...',
      'Instalando dependencias (npm install)...',
      'Configurando variables de entorno...',
      'Iniciando servicio S9-Triplex...',
      '✓ Bot activo — corriendo 24/7',
    ];
    msgs.forEach((m, i) => setTimeout(() => {
      setDeployLog(prev => [...prev, { time: new Date().toLocaleTimeString('es-CO', { hour12: false }), msg: m }]);
      if (i === msgs.length - 1) { setDeploying(false); setDeployStatus('done'); }
    }, 800 * (i + 1)));
  };

  const handleGitPush = () => {
    setGitStatus('pushing');
    setTimeout(() => setGitStatus(Math.random() > 0.15 ? 'ok' : 'fail'), 1600);
  };

  const TABS = [
    { id: 'server', label: '☁ Servidor 24/7' },
    { id: 'git',    label: '⌥ Git / GitHub' },
    { id: 'mobile', label: '📱 Acceso Móvil' },
    { id: 'download', label: '⬇ Descargar' },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: T.surf3, border: `1px solid ${T.bdr2}`, borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 18px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
            background: tab === t.id ? T.surf : 'transparent',
            color: tab === t.id ? T.txt : T.mutHi,
            border: `1px solid ${tab === t.id ? T.bdr2 : 'transparent'}`,
            transition: 'all 0.15s',
          }}>{t.label}</div>
        ))}
      </div>

      {/* ── TAB: SERVIDOR ── */}
      {tab === 'server' && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16 }}>
          {/* Provider list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...SERVERS, ...customServers].map(s => (
              <div key={s.id} onClick={() => setServerProv(s.id)} style={{
                background: serverProv === s.id ? T.surf2 : T.surf,
                border: `1px solid ${serverProv === s.id ? T.acc+'66' : T.bdr}`,
                borderRadius: 8, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.txt, flex: 1 }}>{s.name}</span>
                  <Pill color={s.badgeColor}>{s.badge}</Pill>
                </div>
                <div style={{ fontSize: 11, color: T.mut }}>{s.desc}</div>
                <div style={{ fontSize: 11, color: T.mutHi, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>{s.price}</div>
              </div>
            ))}
          </div>

          {/* Add custom server */}
          {addingCustom ? (
            <Card pad={14}>
              <Label>Nuevo servidor personalizado</Label>
              <input value={newServer.name} onChange={e => setNewServer(p => ({...p, name: e.target.value}))} placeholder="Nombre (ej: Mi VPS Hetzner)"
                style={{ width: '100%', background: T.bg, border: `1px solid ${T.acc}`, borderRadius: 6, color: T.txt, fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
              <input value={newServer.url} onChange={e => setNewServer(p => ({...p, url: e.target.value}))} placeholder="URL o IP (https://mi-bot.example.com)"
                style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }} />
              <input value={newServer.notes} onChange={e => setNewServer(p => ({...p, notes: e.target.value}))} placeholder="Notas (RAM, ubicación, proveedor...)"
                style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'inherit', marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="accent" onClick={addCustomServer} style={{ flex: 1 }}>Agregar</Btn>
                <Btn variant="ghost" onClick={() => setAddingCustom(false)} style={{ flex: 1 }}>Cancelar</Btn>
              </div>
            </Card>
          ) : (
            <Btn variant="ghost" onClick={() => setAddingCustom(true)} style={{ width: '100%', borderStyle: 'dashed' }}>+ Agregar servidor personalizado</Btn>
          )}

          {/* Provider detail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card pad={20}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <span style={{ fontSize: 24 }}>{selServer.icon}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: T.txt }}>{selServer.name}</span>
                    <Pill color={selServer.badgeColor}>{selServer.badge}</Pill>
                  </div>
                  <Mono style={{ fontSize: 12, color: T.mutHi }}>{selServer.price}</Mono>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selServer.url && <Btn variant="ghost" small onClick={() => window.open(selServer.url, '_blank')}>Abrir sitio ↗</Btn>}
                  {selServer.id.startsWith('custom_') && <Btn variant="danger" small onClick={() => removeCustomServer(selServer.id)}>Eliminar</Btn>}
                  <Btn variant="grn" onClick={handleDeploy} disabled={deploying} style={{ minWidth: 140 }}>
                    {deploying ? '⏳ Desplegando...' : deployStatus === 'done' ? '✓ Desplegado' : '🚀 Desplegar'}
                  </Btn>
                </div>
              </div>

              <Label>Pasos de configuración</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {selServer.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: deployStatus === 'done' && i < selServer.steps.length ? T.grn : T.surf3, border: `1px solid ${deployStatus === 'done' ? T.grn : T.bdr2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: deployStatus === 'done' ? '#000' : T.mut, flexShrink: 0, marginTop: 1 }}>{deployStatus === 'done' ? '✓' : i + 1}</div>
                    <span style={{ fontSize: 13, color: T.mutHi, lineHeight: 1.5 }}>{step}</span>
                  </div>
                ))}
              </div>

              <Label>Variables de entorno requeridas</Label>
              <div style={{ background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, padding: '12px 14px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                {selServer.envVars.map(v => (
                  <div key={v} style={{ color: v.includes('=') ? T.grn : T.acc, marginBottom: 3 }}>{v.includes('=') ? v : `${v}=<tu_valor>`}</div>
                ))}
              </div>
            </Card>

            {/* Deploy log */}
            {deployLog.length > 0 && (
              <Card pad={0}>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${T.bdr}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Label style={{ marginBottom: 0 }}>Log de despliegue</Label>
                  {deployStatus === 'done' && <Pill color="grn">✓ Online</Pill>}
                </div>
                <div style={{ padding: '10px 0' }}>
                  {deployLog.map((l, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, padding: '3px 16px', animation: 'slide-in 0.2s ease' }}>
                      <Mono style={{ fontSize: 10, color: T.mut, flexShrink: 0 }}>{l.time}</Mono>
                      <span style={{ fontSize: 12, color: l.msg.startsWith('✓') ? T.grn : T.mutHi }}>{l.msg}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: GIT ── */}
      {tab === 'git' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card pad={20}>
            <Label>Repositorio Git</Label>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>URL del repositorio</div>
              <input type="text" value={gitVals.repoUrl} onChange={e => setGit('repoUrl', e.target.value)}
                placeholder="https://github.com/tu-usuario/s9-triplex.git"
                style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '9px 12px', outline: 'none' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Personal Access Token</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type={showToken ? 'text' : 'password'} value={gitVals.token} onChange={e => setGit('token', e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  style={{ flex: 1, background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '9px 12px', outline: 'none' }} />
                <Btn variant="ghost" small onClick={() => setShowToken(p => !p)}>{showToken ? '🙈' : '👁'}</Btn>
              </div>
              <div style={{ fontSize: 11, color: T.mut, marginTop: 4 }}>GitHub → Settings → Developer settings → Personal access tokens</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Rama</div>
                <input type="text" value={gitVals.branch} onChange={e => setGit('branch', e.target.value)}
                  style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '9px 12px', outline: 'none' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Proveedor</div>
                <select style={{ width: '100%', background: T.surf3, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontSize: 13, padding: '9px 12px', outline: 'none', cursor: 'pointer' }}>
                  {['GitHub', 'GitLab', 'Bitbucket'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: T.mut, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Mensaje de commit</div>
              <input type="text" value={gitVals.commitMsg} onChange={e => setGit('commitMsg', e.target.value)}
                style={{ width: '100%', background: T.bg, border: `1px solid ${T.bdr2}`, borderRadius: 6, color: T.txt, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, padding: '9px 12px', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="ghost" onClick={() => setGitStatus('checking')} style={{ flex: 1 }}>Verificar conexión</Btn>
              <Btn variant="accent" onClick={handleGitPush} style={{ flex: 1 }} disabled={!gitVals.repoUrl}>
                {gitStatus === 'pushing' ? '⏳ Subiendo...' : '⬆ Push'}
              </Btn>
            </div>
            {gitStatus === 'ok'   && <div style={{ marginTop: 10, padding: '10px 14px', background: '#0d2e1a', borderRadius: 6, fontSize: 12, color: T.grn }}>✓ Push exitoso → {gitVals.repoUrl.split('/').slice(-1)[0] || 'repo'} · rama {gitVals.branch}</div>}
            {gitStatus === 'fail' && <div style={{ marginTop: 10, padding: '10px 14px', background: '#2a0d13', borderRadius: 6, fontSize: 12, color: T.red }}>✗ Error de autenticación — verifica tu token</div>}
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card pad={16}>
              <Label>Archivos que se subirán</Label>
              {[
                ['📄', 'config/s9-rules.json', 'Reglas y parámetros de la estrategia'],
                ['📄', 'strategies/*.js', 'Código personalizado por estrategia'],
                ['📄', 'package.json', 'Dependencias Node.js'],
                ['📄', '.env.example', 'Plantilla de variables de entorno (sin secretos)'],
                ['📁', 'src/', 'Motor principal S9-Triplex'],
                ['📁', 'execution/', 'Módulos de ejecución'],
                ['📁', 'validation/', 'Validación visual + IA'],
              ].map(([ic, f, d]) => (
                <div key={f} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{ic}</span>
                  <div>
                    <Mono style={{ fontSize: 12, color: T.acc }}>{f}</Mono>
                    <div style={{ fontSize: 11, color: T.mut }}>{d}</div>
                  </div>
                </div>
              ))}
              <Divider />
              <div style={{ fontSize: 11, color: T.yel }}>⚠ .env y API keys NUNCA se suben — están en .gitignore</div>
            </Card>
            <Card pad={16}>
              <Label>Comandos útiles</Label>
              {[
                'git init',
                'git add .',
                `git commit -m "${gitVals.commitMsg}"`,
                `git remote add origin ${gitVals.repoUrl || '<url>'}`,
                `git push -u origin ${gitVals.branch}`,
              ].map(cmd => (
                <div key={cmd} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, background: T.bg, borderRadius: 5, padding: '6px 10px' }}>
                  <Mono style={{ fontSize: 11, color: T.grn }}>{cmd}</Mono>
                  <Btn variant="ghost" small onClick={() => navigator.clipboard?.writeText(cmd)}>⎘</Btn>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB: MÓVIL ── */}
      {tab === 'mobile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card pad={20}>
            <Label>Acceso desde móvil</Label>
            <div style={{ fontSize: 13, color: T.mutHi, marginBottom: 16, lineHeight: 1.6 }}>
              Una vez desplegado en un servidor, accedes al dashboard desde cualquier dispositivo con el navegador — sin instalar nada.
            </div>
            {[
              { title: 'URL pública del servidor', desc: 'Railway/Render te dan una URL tipo https://s9-bot.railway.app', icon: '🌐', color: T.acc },
              { title: 'Instala como app (PWA)', desc: 'En Chrome/Safari → "Añadir a pantalla de inicio" — funciona como app nativa', icon: '📱', color: T.grn },
              { title: 'Tunnel local (desarrollo)', desc: 'ngrok http 8080 → URL pública temporal para probar desde móvil', icon: '🔗', color: T.yel },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: 14, marginBottom: 16, padding: '14px 16px', background: T.surf3, borderRadius: 8, border: `1px solid ${T.bdr2}` }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: item.color, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: T.mutHi, lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </Card>
          <Card pad={20}>
            <Label>Instalación PWA — paso a paso</Label>
            {[
              ['📲', 'iPhone / Safari', 'Abre la URL → toca ⎙ Compartir → "Añadir a inicio"'],
              ['📲', 'Android / Chrome', 'Abre la URL → toca ⋮ Menú → "Instalar app" o "Añadir a pantalla"'],
              ['💻', 'Desktop / Chrome', 'Haz clic en el ícono ⊕ en la barra de direcciones'],
            ].map(([ic, title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 18 }}>{ic}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.txt, marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 12, color: T.mutHi }}>{desc}</div>
                </div>
              </div>
            ))}
            <Divider />
            <Label>Notificaciones push</Label>
            <div style={{ fontSize: 12, color: T.mutHi, lineHeight: 1.6 }}>
              Las alertas se reciben por <strong style={{ color: T.txt }}>Telegram</strong> en tu móvil sin importar dónde estés — el bot las envía desde el servidor directamente al chat.
            </div>
            <div style={{ marginTop: 12, background: '#0d2e1a', border: `1px solid ${T.grn}44`, borderRadius: 6, padding: '10px 14px', fontSize: 12, color: T.grn }}>
              ✓ Configura tu Telegram Bot en la sección APIs & Claves para recibir señales, P&L y heartbeat en tu móvil 24/7
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB: DESCARGAR ── */}
      {tab === 'download' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card pad={20}>
            <Label>Descargar proyecto</Label>
            <div style={{ fontSize: 13, color: T.mutHi, marginBottom: 20, lineHeight: 1.6 }}>
              Descarga el código fuente completo del bot para ejecutarlo localmente o subirlo a tu servidor.
            </div>
            {[
              { label: 'Proyecto completo (.zip)', desc: 'Todo el código + config + ejemplos', size: '~4.2 MB', variant: 'accent', icon: '📦' },
              { label: 'Solo config (s9-rules.json)', desc: 'Parámetros actuales de la estrategia', size: '~8 KB', variant: 'ghost', icon: '⚙' },
              { label: 'Estrategias personalizadas', desc: 'Código JS + instrucciones por estrategia', size: '~12 KB', variant: 'ghost', icon: '◎' },
              { label: 'Docker Compose', desc: 'docker-compose.yml + Dockerfile listos', size: '~2 KB', variant: 'ghost', icon: '🐳' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: T.surf3, border: `1px solid ${T.bdr2}`, borderRadius: 8, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.txt }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: T.mut }}>{item.desc} · {item.size}</div>
                  </div>
                </div>
                <Btn variant={item.variant} small>⬇ Descargar</Btn>
              </div>
            ))}
          </Card>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card pad={16}>
              <Label>Estructura del proyecto</Label>
              {[
                ['📁', 'src/', 'Motor principal S9-Triplex'],
                ['📁', 'config/', 's9-rules.json + estrategias'],
                ['📁', 'strategies/', 'Código JS personalizado'],
                ['📁', 'execution/', 'Order manager + webhook'],
                ['📁', 'validation/', 'Visual AI + screenshotter'],
                ['📁', 'backtesting/', 'Motor + Monte Carlo'],
                ['📄', '.env.example', 'Plantilla de variables'],
                ['📄', 'package.json', 'Node.js ≥ 20'],
                ['📄', 'Dockerfile', 'Imagen Docker lista'],
                ['📄', 'README.md', 'Guía de instalación'],
              ].map(([ic, f, d]) => (
                <div key={f} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{ic}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <Mono style={{ fontSize: 12, color: T.acc }}>{f}</Mono>
                    <span style={{ fontSize: 11, color: T.mut }}>{d}</span>
                  </div>
                </div>
              ))}
            </Card>
            <Card pad={16}>
              <Label>Instalación rápida</Label>
              {[
                'git clone <tu-repo>',
                'cd S9-Triplex',
                'cp .env.example .env',
                'nano .env  # agrega tus API keys',
                'npm install',
                'npm run backtest  # valida primero',
                'npm start         # bot en vivo',
              ].map((cmd, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, background: T.bg, borderRadius: 5, padding: '5px 10px' }}>
                  <Mono style={{ fontSize: 11, color: cmd.startsWith('#') ? T.mut : T.grn }}>{cmd}</Mono>
                  {!cmd.startsWith('#') && <Btn variant="ghost" small onClick={() => navigator.clipboard?.writeText(cmd)}>⎘</Btn>}
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── EXPORT TO WINDOW ─────────────────────────────────────────────────────────
Object.assign(window, {
  T, Card, Label, Mono, Pill, Btn, Toggle, Divider,
  STRATEGIES_DEFAULT,
  DashboardSection, PositionsSection, SignalsSection,
  BacktestSection, ConfigSection, APIsSection, StrategiasSection,
  DeploySection, OrdersSection,
});
