import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'highlight' | 'critical' | 'emerald';
  trend?: 'up' | 'down' | 'neutral';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtext,
  icon,
  variant = 'default',
}) => {
  const getBorderColor = () => {
    switch (variant) {
      case 'highlight':
        return 'var(--border-active)';
      case 'critical':
        return 'var(--state-critical)';
      case 'emerald':
        return 'var(--traffic-emerald)';
      default:
        return 'var(--border-subtle)';
    }
  };

  return (
    <div
      className="traffic-card"
      style={{
        borderColor: getBorderColor(),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        {icon && <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span
          className="font-mono"
          style={{
            fontSize: typeof value === 'string' && value.length > 12 ? (value.length > 18 ? '15px' : '18px') : '28px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {unit}
          </span>
        )}
      </div>

      {subtext && (
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
          {subtext}
        </div>
      )}
    </div>
  );
};
