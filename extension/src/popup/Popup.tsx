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
  const [isRestrictedTab, setIsRestrictedTab] = useState<boolean>(false);

  // Safe tab messenger that handles missing content scripts and injects dynamically
  const sendToActiveTab = async (message: any): Promise<any> => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return null;
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs: any[]) => {
        const tab = tabs[0];
        if (!tab?.id) {
          resolve(null);
          return;
        }

        const tabUrl = tab.url || '';
        if (
          tabUrl.startsWith('chrome://') ||
          tabUrl.startsWith('chrome-extension://') ||
          tabUrl.startsWith('edge://') ||
          tabUrl.startsWith('about:')
        ) {
          setIsRestrictedTab(true);
          resolve(null);
          return;
        }

        setIsRestrictedTab(false);

        // Attempt initial message
        chrome.tabs.sendMessage(tab.id, message, async (response: any) => {
          if (chrome.runtime?.lastError) {
            // Content script not loaded yet - inject on the fly if permissions allow
            if (chrome.scripting) {
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['content.js'],
                });
                // Small grace period for DOM attachment
                setTimeout(() => {
                  chrome.tabs.sendMessage(tab.id, message, (resp2: any) => {
                    resolve(resp2 || null);
                  });
                }, 150);
                return;
              } catch (injectionErr) {
                resolve(null);
                return;
              }
            }
            resolve(null);
            return;
          }
          resolve(response || null);
        });
      });
    });
  };

  // Query active tab state on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.local) {
        chrome.storage.local.get(['tryOnEnabled', 'activeCategory', 'activeStyle'], (result: any) => {
          if (result.activeCategory) setCategory(result.activeCategory);
          if (result.activeStyle) setStyle(result.activeStyle);
        });
      }

      if (chrome.tabs?.query) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
          const tab = tabs[0];
          if (tab?.title) setTargetTabTitle(tab.title.slice(0, 26) + '...');
          const tabUrl = tab?.url || '';
          if (
            tabUrl.startsWith('chrome://') ||
            tabUrl.startsWith('chrome-extension://') ||
            tabUrl.startsWith('edge://') ||
            tabUrl.startsWith('about:')
          ) {
            setIsRestrictedTab(true);
            return;
          }

          sendToActiveTab({ action: 'GET_STATUS' }).then((resp) => {
            if (resp && typeof resp.isOpen === 'boolean') {
              setIsActive(resp.isOpen);
            }
          });
        });
      }
    }
  }, []);

  const handleToggle = async () => {
    const nextState = !isActive;
    setIsActive(nextState);

    await sendToActiveTab({
      action: nextState ? 'ENABLE_TRY_ON' : 'DISABLE_TRY_ON',
      category,
      style,
    });

    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ tryOnEnabled: nextState });
    }
  };

  const handleCategorySelect = (cat: TryOnCategory) => {
    setCategory(cat);
    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.local) {
        chrome.storage.local.set({ activeCategory: cat });
      }
      sendToActiveTab({ action: 'SET_CATEGORY', category: cat });
    }
  };

  const handleStyleSelect = (st: TryOnStyle) => {
    setStyle(st);
    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.local) {
        chrome.storage.local.set({ activeStyle: st });
      }
      sendToActiveTab({ action: 'SET_STYLE', style: st });
    }
  };

  const handleOpenTestPage = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
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
        {isRestrictedTab && (
          <div style={{ marginBottom: '12px', padding: '10px', borderRadius: '8px', backgroundColor: '#451a03', border: '1px solid #78350f', fontSize: '11px', color: '#fef3c7' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>⚠️ Internal Browser Tab Detected</div>
            <p style={{ margin: '0 0 8px 0', fontSize: '10px', color: '#fde68a', lineHeight: 1.4 }}>
              Chrome prevents extensions from running on <code>chrome://</code> pages. Switch to any website (e.g. Google, Amazon) or launch the test store below:
            </p>
            <button
              onClick={handleOpenTestPage}
              style={{
                width: '100%',
                padding: '6px',
                backgroundColor: '#d97706',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Open Test Store in New Tab
            </button>
          </div>
        )}

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
          onClick={handleOpenTestPage}
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
