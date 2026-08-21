import React from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, Radio, Cpu, History, Sun, Moon } from 'lucide-react';

interface NavbarProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  isBackendConnected: boolean;
  activeCamera?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  theme,
  toggleTheme,
  isBackendConnected,
  activeCamera = 'cam_5',
}) => {
  return (
    <header
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '0 24px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand & Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <NavLink
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: 'var(--text-primary)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Cpu size={18} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                TRAFFICTWIN
                <span style={{ fontSize: '10px', background: 'var(--bg-surface-highlight)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  v1.0
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>
                AIC21 DECISION INTELLIGENCE
              </div>
            </div>
          </NavLink>

          {/* Active Camera Badge */}
          <div
            style={{
              marginLeft: '12px',
              padding: '4px 10px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ color: 'var(--text-tertiary)' }}>CAM:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{activeCamera.toUpperCase()}</strong>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--border-medium)' : 'transparent'}`,
            })}
          >
            <Activity size={15} />
            Overview
          </NavLink>

          <NavLink
            to="/live"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--border-medium)' : 'transparent'}`,
            })}
          >
            <Radio size={15} />
            Live Analysis
          </NavLink>

          <NavLink
            to="/simulate"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
              color: isActive ? '#38bdf8' : 'var(--text-primary)',
              backgroundColor: isActive ? 'rgba(56, 189, 248, 0.12)' : 'var(--bg-surface-elevated)',
              border: `1px solid ${isActive ? '#38bdf8' : 'var(--border-subtle)'}`,
            })}
          >
            <Cpu size={15} color={undefined} />
            What-If Simulator
          </NavLink>

          <NavLink
            to="/history"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
              border: `1px solid ${isActive ? 'var(--border-medium)' : 'transparent'}`,
            })}
          >
            <History size={15} />
            History & Data
          </NavLink>
        </nav>

        {/* System Controls & Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Backend Connection Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: isBackendConnected ? 'var(--state-low)' : 'var(--state-high)',
            }}
          >
            <div
              className="pulse-dot"
              style={{
                backgroundColor: isBackendConnected ? 'var(--state-low)' : 'var(--state-high)',
              }}
            />
            <span>{isBackendConnected ? 'ML CORE ONLINE' : 'OFFLINE MODE'}</span>
          </div>

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              width: '36px',
              height: '36px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
};
