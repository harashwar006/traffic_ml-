import React from 'react';
import type { CurrentState } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { Database, CheckCircle2, HardDrive, Cpu } from 'lucide-react';

interface HistoryProps {
  state: CurrentState;
}

export const History: React.FC<HistoryProps> = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="traffic-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            SYSTEM AUDIT & EVALUATION
          </span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
          AIC21 Dataset Statistics & ML Benchmark Logs
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Real evaluation against AIC21 Track 1 ground truth and verified system specifications.
        </p>
      </div>

      {/* Benchmark Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Total Dataset Videos"
          value="31"
          unit="videos"
          subtext="5.43 GB • 0 Corrupted • 0 Dups"
          icon={<Database size={18} />}
        />
        <MetricCard
          label="Inference Throughput"
          value="60.8"
          unit="FPS"
          subtext="NVIDIA RTX 3050 (4GB VRAM)"
          icon={<Cpu size={18} />}
          variant="highlight"
        />
        <MetricCard
          label="Counting GT Window"
          value="600"
          unit="frames"
          subtext="cam_5 first 60s sample (96 GT events)"
          icon={<CheckCircle2 size={18} />}
        />
        <MetricCard
          label="Track Retention"
          value="30"
          unit="frames"
          subtext="ByteTrack occlusion memory buffer"
          icon={<HardDrive size={18} />}
        />
      </div>

      {/* Dataset & Evaluation Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Cam_5 GT Evaluation Table */}
        <div className="traffic-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Ground Truth Evaluation Benchmark (cam_5)</h2>
            <span className="badge badge-medium">GT VERIFIED</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                <th style={{ padding: '6px' }}>Metric</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>GT Value</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>Predicted</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>MAE / Delta</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>Total Vehicle Count</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} className="font-mono">96</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} className="font-mono">44</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--state-high)' }}>52.0 (54%)</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>Car Class (Class 1)</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} className="font-mono">95</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} className="font-mono">44</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>49.0</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>Truck Class (Class 2)</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} className="font-mono">1</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} className="font-mono">0</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>1.0</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>Processing Runtime</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>60.0s (video)</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>9.87s</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--traffic-emerald)' }}>6.1x Realtime</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={14} />
            Ground truth available strictly for cam_5 first 60 seconds in AIC21 Track 1.
          </div>
        </div>

        {/* Dataset Breakdown */}
        <div className="traffic-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>AIC21 Camera Configurations</h2>
            <span className="badge badge-low">20 ROIs LOADED</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)', textAlign: 'left' }}>
                <th style={{ padding: '6px' }}>Camera</th>
                <th style={{ padding: '6px' }}>Type</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>Movements</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>Resolution</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 700 }}>cam_5</td>
                <td style={{ padding: '8px 6px', color: 'var(--text-secondary)' }}>Fisheye 4-Leg</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} className="font-mono">12</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>1280x960</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 700 }}>cam_1</td>
                <td style={{ padding: '8px 6px', color: 'var(--text-secondary)' }}>PTZ 3-Leg</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} className="font-mono">6</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>1920x1080</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 700 }}>cam_7</td>
                <td style={{ padding: '8px 6px', color: 'var(--text-secondary)' }}>Overhead Normal</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} className="font-mono">12</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>1280x720</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 700 }}>cam_9</td>
                <td style={{ padding: '8px 6px', color: 'var(--text-secondary)' }}>Highway Ramp</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }} className="font-mono">4</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>1280x720</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Info: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);
