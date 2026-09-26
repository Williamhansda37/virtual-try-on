import React, { useState, useEffect } from 'react';
import { Glasses, Watch, Sparkles, Activity, Settings, RefreshCw, Power } from 'lucide-react';
import { TryOnCategory } from '../../../shared/types/try-on';

declare const chrome: any;

export const Popup: React.FC = () => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [category, setCategory] = useState<TryOnCategory>('eyewear');
  const [fps, setFps] = useState<number>(30);
  const [serverStatus, setServerStatus] = useState<'connected' | 'offline'>('connected');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['tryOnEnabled', 'activeCategory'], (result: any) => {
        if (result.tryOnEnabled !== undefined) setIsActive(result.tryOnEnabled);
        if (result.activeCategory) setCategory(result.activeCategory);
      });
    }
  }, []);

  const handleToggle = () => {
    const nextState = !isActive;
    setIsActive(nextState);

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_TRY_ON', state: nextState });
        }
      });
      if (chrome.storage?.local) {
        chrome.storage.local.set({ tryOnEnabled: nextState });
      }
    }
  };

  const handleCategorySelect = (cat: TryOnCategory) => {
    setCategory(cat);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ activeCategory: cat });
    }
  };

  return (
    <div style={{ padding: '16px', backgroundColor: '#090d16', color: '#f8fafc', fontSize: '13px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={16} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>3D Virtual Try-On</h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Manifest V3 Client</p>
          </div>
        </div>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: serverStatus === 'connected' ? '#064e3b' : '#7f1d1d', color: serverStatus === 'connected' ? '#34d399' : '#f87171' }}>
          {serverStatus === 'connected' ? 'Edge OK' : 'Offline'}
        </span>
      </div>

      {/* Main Switch */}
      <div style={{ marginTop: '16px', padding: '12px', borderRadius: '10px', backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500 }}>Live Try-On Overlay</span>
          <button
            onClick={handleToggle}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isActive ? '#10b981' : '#334155',
              color: '#ffffff',
              fontWeight: 600,
            }}
          >
            <Power size={14} />
            {isActive ? 'Active' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Categories */}
      <div style={{ marginTop: '16px' }}>
        <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Accessory Category</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px' }}>
          <button
            onClick={() => handleCategorySelect('eyewear')}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: category === 'eyewear' ? '1px solid #3b82f6' : '1px solid #1e293b',
              backgroundColor: category === 'eyewear' ? '#1e3a8a' : '#0f172a',
              color: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Glasses size={14} /> Eyewear
          </button>
          <button
            onClick={() => handleCategorySelect('watch')}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: category === 'watch' ? '1px solid #3b82f6' : '1px solid #1e293b',
              backgroundColor: category === 'watch' ? '#1e3a8a' : '#0f172a',
              color: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Watch size={14} /> Watch / Wrist
          </button>
        </div>
      </div>

      {/* Real-time Diagnostics bar */}
      <div style={{ marginTop: '16px', padding: '10px', borderRadius: '8px', backgroundColor: '#030712', border: '1px solid #111827', fontSize: '11px', color: '#64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Tracking Engine:</span>
          <span style={{ color: '#38bdf8' }}>MediaPipe Tasks Vision</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Renderer:</span>
          <span style={{ color: '#a78bfa' }}>Three.js WebGL2</span>
        </div>
      </div>
    </div>
  );
};
