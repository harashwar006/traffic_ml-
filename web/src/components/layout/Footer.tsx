import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '16px 24px',
        marginTop: 'auto',
        fontSize: '12px',
        color: 'var(--text-tertiary)',
      }}
    >
      <div
        style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <strong style={{ color: 'var(--text-secondary)' }}>TrafficTwin</strong> — AIC21 Track 1 Counterfactual Traffic Decision System
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <span>Detection: YOLOv8n (COCO)</span>
          <span>•</span>
          <span>Tracker: ByteTrack</span>
          <span>•</span>
          <span>Hardware: RTX 3050 (4GB CUDA)</span>
        </div>
      </div>
    </footer>
  );
};
