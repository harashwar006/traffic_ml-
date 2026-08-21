import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { CurrentState } from '../types';
import { TrafficStateBadge } from '../components/common/TrafficStateBadge';
import { MetricCard } from '../components/common/MetricCard';
import { Car, Clock, ShieldAlert, TrendingUp, ArrowRight, Play, CheckCircle2, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

interface OverviewProps {
  state: CurrentState;
  onRunSimulation: () => void;
}

export const Overview: React.FC<OverviewProps> = ({ state }) => {
  const navigate = useNavigate();
  const metrics = state.metrics;
  const rec = state.recommendation;
  const prediction = state.prediction;

  const chartData = (state.history || []).map((h) => ({
    time: `${h.timestamp_sec}s`,
    flow: h.flow_rate_per_min,
    vehicles: h.total_count,
  }));

  const totalCount = metrics?.total_vehicle_count ?? 0;
  const carCount = metrics?.car_count ?? 0;
  const truckCount = metrics?.truck_count ?? 0;
  const flowRate = metrics?.flow_rate_per_min ?? 0.0;
  const queueEst = prediction?.future_queue_estimate ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner: Status & Main Strategic Objective */}
      <div
        className="traffic-card"
        style={{
          background: 'linear-gradient(180deg, var(--bg-surface-elevated) 0%, var(--bg-surface) 100%)',
          borderLeft: '4px solid var(--border-active)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
              OPERATIONAL SITUATION REPORT
            </span>
            <TrafficStateBadge state={metrics?.traffic_state || 'UNKNOWN'} size="sm" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {state.camera_id ? `Active Surveillance: ${state.camera_id.toUpperCase()} Intersection` : 'Intelligent Signal Control Active'}
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {metrics?.direction_imbalance_detected
              ? `Directional imbalance detected: Major flow on Movement ${metrics.dominant_movement ?? 'N/A'} (${metrics.direction_imbalance_ratio.toFixed(1)}x cross-flow).`
              : 'Traffic flow is balanced across active intersection movements.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/live')}
          >
            <Play size={16} />
            View Live Stream
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/simulate')}
          >
            <Cpu size={16} />
            Test Signal Decisions
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Primary Decision Hierarchy */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <MetricCard
          label="Total Vehicles Detected"
          value={totalCount}
          unit="vehicles"
          subtext={`${carCount} Cars • ${truckCount} Trucks`}
          icon={<Car size={18} />}
        />

        <MetricCard
          label="Observed Flow Rate"
          value={flowRate.toFixed(1)}
          unit="veh/min"
          subtext="Throughput based on ROI exits"
          icon={<TrendingUp size={18} />}
          variant={metrics?.traffic_state === 'CRITICAL' ? 'critical' : 'default'}
        />

        <MetricCard
          label="Estimated Queue Length"
          value={queueEst}
          unit="vehicles"
          subtext="Estimated under current plan"
          icon={<Clock size={18} />}
          variant="highlight"
        />

        <MetricCard
          label="Directional Imbalance"
          value={metrics?.direction_imbalance_detected ? `${metrics.direction_imbalance_ratio.toFixed(1)}x` : '1.0x'}
          unit="ratio"
          subtext={metrics?.direction_imbalance_detected ? `Movement ${metrics.dominant_movement ?? ''} bottleneck` : 'Normal equilibrium'}
          icon={<ShieldAlert size={18} />}
          variant={metrics?.direction_imbalance_detected ? 'critical' : 'default'}
        />
      </div>

      {/* Main Grid: Flow Dynamics vs Recommended Decision */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Left: Flow Trajectory Chart */}
        <div className="traffic-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Traffic Accumulation Over Time</h2>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Vehicle arrival & flow rates from ML pipeline</div>
            </div>
            <span className="badge badge-high">60s WINDOW</span>
          </div>

          <div style={{ width: '100%', height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-medium)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="flow" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#flowGrad)" name="Flow Rate (veh/min)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Decision Intelligence & Recommendation Box */}
        <div
          className="traffic-card"
          style={{
            borderColor: 'var(--traffic-emerald)',
            background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.05) 0%, var(--bg-surface) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="badge badge-low">
                <CheckCircle2 size={12} />
                AI RECOMMENDATION ENGINE
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Confidence: {rec ? Math.round(rec.confidence * 100) : 92}%</span>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              {rec?.action || 'Extend Major Phase by 20 Seconds'}
            </h2>

            <div style={{ display: 'flex', gap: '16px', margin: '14px 0', padding: '12px', background: 'var(--bg-surface-elevated)', borderRadius: '6px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>EXPECTED QUEUE</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--traffic-emerald)' }}>
                  {rec?.predicted_queue_change_pct ? `${rec.predicted_queue_change_pct}%` : '-45.0%'}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>EXPECTED DELAY</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--traffic-emerald)' }}>
                  {rec?.predicted_wait_change_sec ? `${rec.predicted_wait_change_sec}s` : '-22.0s'}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(rec?.reasoning || []).map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <ChevronRight size={15} style={{ color: 'var(--traffic-emerald)', flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    <strong style={{ color: 'var(--text-primary)' }}>{r.factor}:</strong> {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-accent"
            onClick={() => navigate('/simulate')}
            style={{ marginTop: '18px' }}
          >
            Launch What-If Strategy Simulator
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

const Cpu: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="16" x="4" y="4" rx="2" />
    <rect width="6" height="6" x="9" y="9" rx="1" />
    <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
  </svg>
);
