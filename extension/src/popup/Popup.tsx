import React, { useState, useEffect } from 'react';
import { Glasses, Watch, Gem, Sparkles, Video, VideoOff, ExternalLink, Sliders } from 'lucide-react';

declare const chrome: any;

export type TryOnCategory = 'eyewear' | 'watch' | 'jewelry';
export type TryOnStyle = 'gold' | 'silver' | 'onyx' | 'neon';

export const Popup: React.FC = () => {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [category, setCategory] = useState<TryOnCategory>('eyewear');
  const [style, setStyle] = useState<TryOnStyle>('gold');
  const [targetTabTitle, setTargetTabTitle] = useState<string>('Current Shopping Tab');

  // Query active tab state on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined') {
      // Load stored preferences
      if (chrome.storage?.local) {
        chrome.storage.local.get(['tryOnEnabled', 'activeCategory', 'activeStyle'], (result: any) => {
          if (result.activeCategory) setCategory(result.activeCategory);
          if (result.activeStyle) setStyle(result.activeStyle);
        });
      }

      // Query active tab for actual live status
      if (chrome.tabs?.query) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
          if (tabs[0]?.id) {
            if (tabs[0].title) setTargetTabTitle(tabs[0].title.slice(0, 28) + '...');
            chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_STATUS' }, (resp: any) => {
              if (chrome.runtime?.lastError) {
                // Tab doesn't have content script yet or is internal page
                return;
              }
              if (resp && typeof resp.isOpen === 'boolean') {
                setIsActive(resp.isOpen);
              }
            });
          }
        });
      }
    }
  }, []);

  const handleToggle = () => {
    const nextState = !isActive;
    setIsActive(nextState);

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: nextState ? 'ENABLE_TRY_ON' : 'DISABLE_TRY_ON',
              category,
              style,
            },
            (resp: any) => {
              if (chrome.runtime?.lastError) {
                console.log('[Try-On Popup] Note: Content script not ready on this tab yet.');
              }
            }
          );
        }
      });

      if (chrome.storage?.local) {
        chrome.storage.local.set({ tryOnEnabled: nextState });
      }
    }
  };

  const handleCategorySelect = (cat: TryOnCategory) => {
    setCategory(cat);
    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.local) {
        chrome.storage.local.set({ activeCategory: cat });
      }
      if (chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'SET_CATEGORY', category: cat });
          }
        });
      }
    }
  };

  const handleStyleSelect = (st: TryOnStyle) => {
    setStyle(st);
    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.local) {
        chrome.storage.local.set({ activeStyle: st });
      }
      if (chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'SET_STYLE', style: st });
          }
        });
      }
    }
  };

  const handleOpenStandalone = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      // Open web demo or studio in new tab
      chrome.tabs.create({ url: 'http://localhost:3000' });
    }
  };

  return (
    <div style={{ width: '320px', padding: '16px', backgroundColor: '#090d16', color: '#f8fafc', fontSize: '13px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={16} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>3D Virtual Try-On</h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>Client-Side Camera Engine</p>
          </div>
        </div>
        <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#064e3b', color: '#34d399', fontWeight: 600, border: '1px solid #059669' }}>
          Zero Backend
        </span>
      </div>

      {/* Main Activation Card with Clear Action Button */}
      <div style={{ marginTop: '14px', padding: '14px', borderRadius: '12px', backgroundColor: '#0f172a', border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontWeight: 600, fontSize: '12px', color: '#cbd5e1' }}>Webpage Try-On Camera</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: isActive ? '#34d399' : '#94a3b8' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isActive ? '#10b981' : '#64748b' }}></span>
            {isActive ? 'Active on Page' : 'Standby (Off)'}
          </span>
        </div>

        {/* Clear Action Button (No ambiguity) */}
        <button
          onClick={handleToggle}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: isActive ? '#dc2626' : '#10b981',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: '13px',
            transition: 'background-color 0.2s ease',
            boxShadow: isActive ? '0 4px 12px rgba(220, 38, 38, 0.3)' : '0 4px 12px rgba(16, 185, 129, 0.3)',
          }}
        >
          {isActive ? (
            <>
              <VideoOff size={16} /> Stop Camera Try-On
            </>
          ) : (
            <>
              <Video size={16} /> Launch Camera Try-On
            </>
          )}
        </button>

        <div style={{ marginTop: '8px', fontSize: '10px', color: '#64748b', textAlign: 'center' }}>
          {isActive ? 'Floating camera HUD is open on webpage' : 'Click above to open the real-time camera HUD'}
        </div>
      </div>

      {/* Target Accessory Categories */}
      <div style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Item to Try On</label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          <button
            onClick={() => handleCategorySelect('eyewear')}
            style={{
              padding: '8px 4px',
              borderRadius: '8px',
              border: category === 'eyewear' ? '1px solid #3b82f6' : '1px solid #1e293b',
              backgroundColor: category === 'eyewear' ? '#1e3a8a' : '#0f172a',
              color: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
            }}
          >
            <Glasses size={16} />
            <span>Glasses</span>
          </button>

          <button
            onClick={() => handleCategorySelect('watch')}
            style={{
              padding: '8px 4px',
              borderRadius: '8px',
              border: category === 'watch' ? '1px solid #3b82f6' : '1px solid #1e293b',
              backgroundColor: category === 'watch' ? '#1e3a8a' : '#0f172a',
              color: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
            }}
          >
            <Watch size={16} />
            <span>Watch</span>
          </button>

          <button
            onClick={() => handleCategorySelect('jewelry')}
            style={{
              padding: '8px 4px',
              borderRadius: '8px',
              border: category === 'jewelry' ? '1px solid #3b82f6' : '1px solid #1e293b',
              backgroundColor: category === 'jewelry' ? '#1e3a8a' : '#0f172a',
              color: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
            }}
          >
            <Gem size={16} />
            <span>Pendant</span>
          </button>
        </div>
      </div>

      {/* Material & Finish */}
      <div style={{ marginTop: '14px' }}>
        <label style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Material Finish</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '6px' }}>
          <button
            onClick={() => handleStyleSelect('gold')}
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: style === 'gold' ? '1px solid #eab308' : '1px solid #1e293b',
              backgroundColor: style === 'gold' ? 'rgba(234, 179, 8, 0.15)' : '#0f172a',
              color: style === 'gold' ? '#fde047' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            Gold
          </button>
          <button
            onClick={() => handleStyleSelect('silver')}
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: style === 'silver' ? '1px solid #94a3b8' : '1px solid #1e293b',
              backgroundColor: style === 'silver' ? 'rgba(148, 163, 184, 0.2)' : '#0f172a',
              color: style === 'silver' ? '#f1f5f9' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            Silver
          </button>
          <button
            onClick={() => handleStyleSelect('onyx')}
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: style === 'onyx' ? '1px solid #475569' : '1px solid #1e293b',
              backgroundColor: style === 'onyx' ? 'rgba(71, 85, 105, 0.3)' : '#0f172a',
              color: style === 'onyx' ? '#cbd5e1' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            Onyx
          </button>
          <button
            onClick={() => handleStyleSelect('neon')}
            style={{
              padding: '6px',
              borderRadius: '6px',
              border: style === 'neon' ? '1px solid #06b6d4' : '1px solid #1e293b',
              backgroundColor: style === 'neon' ? 'rgba(6, 182, 212, 0.2)' : '#0f172a',
              color: style === 'neon' ? '#67e8f9' : '#94a3b8',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            Neon
          </button>
        </div>
      </div>

      {/* Standalone Studio Mode Link */}
      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #1e293b' }}>
        <button
          onClick={handleOpenStandalone}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid #334155',
            backgroundColor: '#0f172a',
            color: '#94a3b8',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          <ExternalLink size={13} />
          Open Fullscreen Studio in Tab
        </button>
      </div>

      {/* Standalone Status Diagnostics Bar */}
      <div style={{ marginTop: '12px', padding: '8px 10px', borderRadius: '8px', backgroundColor: '#030712', border: '1px solid #111827', fontSize: '10px', color: '#64748b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span>Architecture:</span>
          <span style={{ color: '#10b981' }}>100% Client-Side In-Browser</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Backend Server:</span>
          <span style={{ color: '#38bdf8' }}>Not Required (Standalone)</span>
        </div>
      </div>
    </div>
  );
};
