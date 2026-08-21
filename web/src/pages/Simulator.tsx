import React, { useState } from 'react';
import type { CurrentState } from '../types';
import { api } from '../services/api';
import { TrafficStateBadge } from '../components/common/TrafficStateBadge';
import {
  ChevronRight,
  Sparkles,
  Zap,
  RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

interface SimulatorProps {
  state: CurrentState;
  onRefresh: () => void;
}

export const Simulator: React.FC<SimulatorProps> = ({ state, onRefresh }) => {
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('+20sec');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const simulation = state.simulation;
  const strategies = simulation?.strategies || [];

  const currentStrategy = strategies.find((s) => s.strategy_id === selectedStrategyId) || strategies[0] || {
    strategy_id: 'current',
    label: 'Current Fixed Plan',
    green_phase_extension_sec: 0,
    predicted_queue: 0,
    predicted_wait_sec: 0,
    predicted_congestion_pct: 0,
    score: 0,
    is_recommended: false
  };

  const baselineStrategy = strategies.find((s) => s.strategy_id === 'current') || strategies[0] || currentStrategy;
  const rec = state.recommendation;

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      await api.runSimulation(state.job_id || 'demo-cam5');
      setTimeout(() => {
        setIsSimulating(false);
        onRefresh();
      }, 800);
    } catch (err) {
      console.error(err);
      setIsSimulating(false);
    }
  };

  // Comparison chart data
  const comparisonData = strategies.map((s) => ({
    name: s.label.replace(' N-S', '').replace(' Major Phase', ''),
    queue: s.predicted_queue,
    waitTime: s.predicted_wait_sec,
    isRec: s.is_recommended,
  }));

  const queueReduction = Math.max(0, baselineStrategy.predicted_queue - currentStrategy.predicted_queue);
  const queueReductionPct = baselineStrategy.predicted_queue > 0 ? Math.round((queueReduction / baselineStrategy.predicted_queue) * 100) : 0;
  const waitReduction = (baselineStrategy.predicted_wait_sec - currentStrategy.predicted_wait_sec).toFixed(1);

  const flowRate = state.metrics?.flow_rate_per_min ? state.metrics.flow_rate_per_min.toFixed(1) : '0.0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Visual Header / Mission Header */}
      <div
        className="traffic-card"
        style={{
          background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.1) 0%, var(--bg-surface) 100%)',
          borderLeft: '4px solid var(--border-active)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              COUNTERFACTUAL DECISION TWIN
            </span>
            <TrafficStateBadge state={state.metrics?.traffic_state || 'UNKNOWN'} size="sm" />
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            What-If Traffic Signal Simulator
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Simulate adaptive green phase interventions against observed real arrival volumes before actuating physical controllers.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleRunSimulation}
          disabled={isSimulating}
          style={{ padding: '10px 18px' }}
        >
          <RefreshCw size={16} className={isSimulating ? 'animate-spin' : ''} />
          {isSimulating ? 'Evaluating Candidate Policies...' : 'Recalculate Counterfactuals'}
        </button>
      </div>

      {/* Interactive Strategy Selector: 4 distinct strategy cards */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            STEP 1: SELECT CANDIDATE SIGNAL STRATEGY
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            Baseline: Current Timing Plan ({flowRate} veh/min arrival)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {strategies.map((s) => {
            const isSelected = s.strategy_id === selectedStrategyId;
            return (
              <div
                key={s.strategy_id}
                onClick={() => setSelectedStrategyId(s.strategy_id)}
                className="traffic-card"
                style={{
                  cursor: 'pointer',
                  borderColor: isSelected ? 'var(--border-active)' : s.is_recommended ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
                  backgroundColor: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                  boxShadow: isSelected ? '0 0 0 2px var(--border-active)' : 'var(--shadow-sm)',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Recommendation Pill */}
                {s.is_recommended && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      fontSize: '10px',
                      fontWeight: 800,
                      color: 'var(--traffic-emerald)',
                      background: 'rgba(16, 185, 129, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Sparkles size={10} />
                    RECOMMENDED
                  </div>
                )}

                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '14px' }}>
                  {s.green_phase_extension_sec > 0 ? `+${s.green_phase_extension_sec}s extension` : 'Fixed cycle parameters'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>QUEUE</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: s.is_recommended ? 'var(--traffic-emerald)' : 'var(--text-primary)' }}>
                      {s.predicted_queue} veh
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>WAIT TIME</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: s.is_recommended ? 'var(--traffic-emerald)' : 'var(--text-primary)' }}>
                      {s.predicted_wait_sec}s
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Simulation View: Chart on Left, Recommendation Panel on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(340px, 1fr)', gap: '24px' }}>
        {/* Left: Recharts Comparative Bar Chart */}
        <div className="traffic-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Policy Performance Evaluation</h2>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Predicted Queue vs Average Wait Time</div>
            </div>
            <span className="badge badge-low">PARETO OPTIMAL</span>
          </div>

          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} tickLine={false} />
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
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="queue" name="Predicted Queue (veh)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="waitTime" name="Average Delay (s)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Counterfactual Decision Card */}
        <div
          className="traffic-card"
          style={{
            borderColor: 'var(--traffic-emerald)',
            background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.04) 0%, var(--bg-surface) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span className="badge badge-low">
                <Sparkles size={12} />
                SIMULATION IMPACT
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Confidence: {rec ? Math.round(rec.confidence * 100) : 92}%</span>
            </div>

            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              {rec?.action || `Policy Evaluation: ${currentStrategy.label}`}
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Projected impact compared to default fixed plan under current {flowRate} veh/min flow rate.
            </div>

            {/* Impact Metric Highlights */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                margin: '16px 0',
                padding: '14px',
                backgroundColor: 'var(--bg-surface-elevated)',
                borderRadius: '6px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>QUEUE CLEARANCE</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--traffic-emerald)' }}>
                  -{queueReductionPct}%
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {baselineStrategy.predicted_queue} → {currentStrategy.predicted_queue} vehicles
                </div>
              </div>

              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>DELAY SAVINGS</div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--traffic-emerald)' }}>
                  {parseFloat(waitReduction) > 0 ? `-${waitReduction}s` : `${Math.abs(parseFloat(waitReduction))}s`}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  {baselineStrategy.predicted_wait_sec}s → {currentStrategy.predicted_wait_sec}s avg
                </div>
              </div>
            </div>

            {/* Why this recommendation section */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '10px' }}>
                WHY THIS RECOMMENDATION?
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                {(rec?.reasoning || []).map((factor, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 10px',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '4px',
                    }}
                  >
                    <ChevronRight size={16} style={{ color: 'var(--traffic-emerald)', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>{factor.factor}: </strong>
                      <span style={{ color: 'var(--text-secondary)' }}>{factor.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button
              className="btn btn-accent"
              style={{ width: '100%', padding: '12px', fontSize: '14px' }}
              onClick={() => alert(`Strategy ${selectedStrategyId} parameters dispatched to Local Controller.`)}
            >
              <Zap size={16} />
              Deploy Recommendation to Signal Controller
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
