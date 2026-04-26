// tweaks-panel.jsx — Panel de ajustes visuales flotante (S9-TRIPLEX)

const { useState, useCallback, useEffect } = React;

// ── Hook: useTweaks ───────────────────────────────────────────
function useTweaks(defaults) {
  const LS_KEY = 's9_tweaks';
  const [tweaks, setTweaks] = useState(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? { ...defaults, ...JSON.parse(stored) } : { ...defaults };
    } catch {
      return { ...defaults };
    }
  });

  const setTweak = useCallback((key, value) => {
    setTweaks(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return [tweaks, setTweak];
}

// ── TweaksPanel ───────────────────────────────────────────────
function TweaksPanel({ children }) {
  const [open, setOpen] = useState(false);

  const T = {
    bg: '#0a0b0f', surf: '#10121a', surf2: '#161925', surf3: '#1c2030',
    bdr: '#1e2235', bdr2: '#262b3e',
    acc: '#4f8ef7', txt: '#e2e4f0', mutHi: '#8892b0', mut: '#4a5270',
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Ajustes de visualización"
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
          width: 40, height: 40, borderRadius: '50%',
          background: open ? T.acc : T.surf3,
          border: `1px solid ${open ? T.acc : T.bdr2}`,
          color: open ? '#fff' : T.mutHi,
          fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open ? `0 0 12px ${T.acc}66` : '0 2px 8px #00000044',
          transition: 'all 0.2s',
        }}
      >
        ⚙
      </button>

      {/* Panel slide-in */}
      {open && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 999,
          width: 280,
          background: T.surf,
          borderLeft: `1px solid ${T.bdr}`,
          boxShadow: '-8px 0 32px #00000066',
          display: 'flex', flexDirection: 'column',
          animation: 'slide-in-right 0.2s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${T.bdr}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: T.txt, letterSpacing: '0.05em' }}>
              AJUSTES VISUALES
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', color: T.mutHi, fontSize: 18, cursor: 'pointer', padding: '0 4px' }}
            >
              ×
            </button>
          </div>

          {/* Contenido */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {children}
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.bdr}` }}>
            <div style={{ fontSize: 10, color: T.mut, textAlign: 'center' }}>
              S9-TRIPLEX · Preferencias locales
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}

// ── TweakSection ──────────────────────────────────────────────
function TweakSection({ label }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
      textTransform: 'uppercase', color: '#4a5270',
      marginTop: 16, marginBottom: 8,
      paddingBottom: 6, borderBottom: '1px solid #1e2235',
    }}>
      {label}
    </div>
  );
}

// ── TweakColor ────────────────────────────────────────────────
function TweakColor({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <span style={{ fontSize: 12, color: '#8892b0' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#4a5270', fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: 28, height: 28, border: '1px solid #1e2235',
            borderRadius: 6, cursor: 'pointer', padding: 0,
            background: 'none',
          }}
        />
      </div>
    </div>
  );
}

// ── TweakRadio ────────────────────────────────────────────────
function TweakRadio({ label, value, options, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: '#8892b0', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(opt => {
          const active = value === opt;
          return (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              style={{
                flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600,
                borderRadius: 5, cursor: 'pointer', border: '1px solid',
                borderColor: active ? '#4f8ef7' : '#262b3e',
                background: active ? '#4f8ef722' : '#1c2030',
                color: active ? '#4f8ef7' : '#4a5270',
                transition: 'all 0.15s', fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── TweakToggle ───────────────────────────────────────────────
function TweakToggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <span style={{ fontSize: 12, color: '#8892b0' }}>{label}</span>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
          background: value ? '#4f8ef7' : '#1c2030',
          border: `1px solid ${value ? '#4f8ef7' : '#262b3e'}`,
          position: 'relative', transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: 7, background: '#fff',
          position: 'absolute', top: 2, left: value ? 18 : 2,
          transition: 'left 0.2s',
        }} />
      </div>
    </div>
  );
}
