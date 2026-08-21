import React from 'react';
import type { TrafficState } from '../../types';
import { ShieldCheck, AlertTriangle, AlertOctagon, Flame } from 'lucide-react';

interface TrafficStateBadgeProps {
  state: TrafficState;
  size?: 'sm' | 'md' | 'lg';
}

export const TrafficStateBadge: React.FC<TrafficStateBadgeProps> = ({ state, size = 'md' }) => {
  const getIcon = () => {
    switch (state) {
      case 'LOW':
        return <ShieldCheck size={size === 'lg' ? 20 : size === 'md' ? 16 : 12} />;
      case 'MEDIUM':
        return <AlertTriangle size={size === 'lg' ? 20 : size === 'md' ? 16 : 12} />;
      case 'HIGH':
        return <AlertOctagon size={size === 'lg' ? 20 : size === 'md' ? 16 : 12} />;
      case 'CRITICAL':
        return <Flame size={size === 'lg' ? 20 : size === 'md' ? 16 : 12} />;
      default:
        return null;
    }
  };

  const getBadgeClass = () => {
    switch (state) {
      case 'LOW':
        return 'badge-low';
      case 'MEDIUM':
        return 'badge-medium';
      case 'HIGH':
        return 'badge-high';
      case 'CRITICAL':
        return 'badge-critical';
      default:
        return '';
    }
  };

  const padding = size === 'lg' ? '8px 16px' : size === 'md' ? '4px 10px' : '2px 6px';
  const fontSize = size === 'lg' ? '14px' : size === 'md' ? '12px' : '10px';

  return (
    <span
      className={`badge ${getBadgeClass()}`}
      style={{
        padding,
        fontSize,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 700,
        letterSpacing: '0.04em',
      }}
    >
      {getIcon()}
      {state} TRAFFIC
    </span>
  );
};
