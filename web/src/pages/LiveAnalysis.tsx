import React, { useState, useEffect, useRef } from 'react';
import type { CurrentState, LiveAnalysisState } from '../types';
import { api } from '../services/api';
import { MetricCard } from '../components/common/MetricCard';
import {
  Activity,
  Upload,
  RefreshCw,
  Zap,
  Maximize2,
  Compass,
  Sliders,
  ShieldCheck,
  Cpu,
  Video as VideoIcon,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';

interface LiveAnalysisProps {
  state: CurrentState;
  onRefresh: () => void;
}

const FEED_SOURCES = [
  { id: 'cam_5', name: 'Intersection 5 (Fisheye 4-Leg) • (GT Verified)', videoUrl: '/api/video/stream/cam5_eval_annotated.mp4', hasGt: true },
  { id: 'cam_1', name: 'Intersection 1 (PTZ Angle)', videoUrl: '/api/video/stream/cam_1.mp4', hasGt: false },
  { id: 'cam_7', name: 'Intersection 7 (Overhead Normal)', videoUrl: '/api/video/stream/cam_7.mp4', hasGt: false },
  { id: 'cam_9', name: 'Camera 9 (Highway Ramp)', videoUrl: '/api/video/stream/cam_9.mp4', hasGt: false },
  { id: 'cam_10', name: 'Camera 10 (Single Approach)', videoUrl: '/api/video/stream/cam_10.mp4', hasGt: false },
];

export const LiveAnalysis: React.FC<LiveAnalysisProps> = ({ state, onRefresh }) => {
  // Selected single source
  const [selectedSourceId, setSelectedSourceId] = useState<string>('cam_5');
  const [cameraState, setCameraState] = useState<CurrentState>(state);

  // Active GPU analysis state
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [liveTelemetry, setLiveTelemetry] = useState<LiveAnalysisState | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [videoError, setVideoError] = useState<boolean>(false);
  const [gpuAvailable, setGpuAvailable] = useState<boolean>(true);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check GPU on mount
  useEffect(() => {
    api.checkHealth().then((h) => setGpuAvailable(h.gpu_available)).catch(() => {});
  }, []);

  // Sync state when selectedSourceId changes
  useEffect(() => {
    // 1. Clean up any active WebSocket & live states from previous camera
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setActiveJobId(null);
    setIsAnalyzing(false);
    setLiveTelemetry(null);
    setStatusMessage('');
    setVideoError(false);

    // 2. Fetch selected camera's precomputed / verified baseline state
    let isMounted = true;
    api.getCameraTraffic(selectedSourceId).then((st) => {
      if (isMounted && st) {
        setCameraState(st);
      }
    }).catch(() => {
      if (isMounted) setCameraState(state);
    });

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedSourceId]);

  // Connect WebSocket when an active analysis job is running for the selected source
  useEffect(() => {
    if (!activeJobId) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let isMounted = true;
    const wsUrl = api.getWsUrl(activeJobId);
    console.log('[WebSocket Live Sync] Connecting to:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data && data.frame_index !== undefined) {
            setLiveTelemetry(data);
          }
        } catch (e) {
          console.warn('WS parse error:', e);
        }
      };

      ws.onerror = (err) => {
        console.warn('WebSocket error, using polling fallback:', err);
      };
    } catch (e) {
      console.warn('Could not initialize WebSocket:', e);
    }

    // Secondary fallback polling to guarantee real-time UI synchronization
    const pollInterval = setInterval(async () => {
      if (!isMounted || !activeJobId) return;
      try {
        const live = await api.getLiveAnalysisState(activeJobId);
        if (live && isMounted) {
          setLiveTelemetry(live);
        }
      } catch {}
    }, 200);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeJobId]);

  // Poll Job Completion
  const pollJobStatus = async (jobId: string, camId: string) => {
    const maxAttempts = 180;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await api.getInferenceStatus(jobId);
        if (res.result_ready || res.status === 'READY') {
          setStatusMessage(`Inference complete on GPU for ${camId}.`);
          setIsAnalyzing(false);
          // Fetch final state for this camera
          const updatedState = await api.getCameraTraffic(camId);
          if (updatedState) {
            setCameraState(updatedState);
          }
          onRefresh();
          return;
        } else if (res.status === 'ERROR') {
          setStatusMessage(`Inference failed on ${camId}: ${res.error_message || 'Error'}`);
          setIsAnalyzing(false);
          setActiveJobId(null);
          setLiveTelemetry(null);
          return;
        } else {
          setStatusMessage(
            `GPU Tensor Core Processing [${camId}] • Frame ${res.frames_processed}/${res.total_frames || 600} (${res.current_fps.toFixed(1)} FPS)`
          );
        }
      } catch (err) {
        console.warn('Status poll error:', err);
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    setIsAnalyzing(false);
    setActiveJobId(null);
    setStatusMessage('Analysis timed out.');
  };

  // Launch GPU Inference on Currently Selected Source
  const handleStartInference = async () => {
    try {
      setIsAnalyzing(true);
      setLiveTelemetry(null);
      setVideoError(false);
      setStatusMessage(`Initializing YOLOv8n Tensor Core FP16 for ${selectedSourceId} on GPU...`);
      
      const res = await api.startInference(selectedSourceId, 600);
      setActiveJobId(res.job_id);
      await pollJobStatus(res.job_id, selectedSourceId);
    } catch (err: any) {
      console.error(err);
      setIsAnalyzing(false);
      setActiveJobId(null);
      setLiveTelemetry(null);
      setStatusMessage(`Inference launch failed: ${err.message || 'Error'}`);
    }
  };

  // Handle Custom Video Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    try {
      setIsAnalyzing(true);
      setLiveTelemetry(null);
      setVideoError(false);
      setStatusMessage(`Uploading ${file.name} for ${selectedSourceId}...`);
      
      const uploadRes = await api.uploadVideo(file, selectedSourceId);
      setStatusMessage('Upload complete. Launching GPU inference pipeline...');
      
      const startRes = await api.startInference(uploadRes.job_id, 600);
      setActiveJobId(startRes.job_id);
      await pollJobStatus(startRes.job_id, selectedSourceId);
    } catch (err: any) {
      console.error(err);
      setIsAnalyzing(false);
      setActiveJobId(null);
      setLiveTelemetry(null);
      setStatusMessage(`Upload failed: ${err.message || 'Error'}`);
    }
  };

  // Handle Fullscreen
  const handleFullscreen = () => {
    if (videoContainerRef.current) {
      if (!document.fullscreenElement) {
        videoContainerRef.current.requestFullscreen().catch((err) => {
          console.warn('Fullscreen request failed:', err);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  // Active source metadata
  const currentSource = FEED_SOURCES.find((s) => s.id === selectedSourceId) || FEED_SOURCES[0];

  // Derived live values: prioritize live telemetry during inference, otherwise baseline state
  const totalVehicles = isAnalyzing && liveTelemetry
    ? liveTelemetry.vehicles_counted
    : (cameraState?.metrics?.total_vehicle_count ?? 0);

  const carCount = isAnalyzing && liveTelemetry
    ? (liveTelemetry.vehicle_classes?.Car ?? 0)
    : (cameraState?.metrics?.car_count ?? 0);

  const truckCount = isAnalyzing && liveTelemetry
    ? (liveTelemetry.vehicle_classes?.Truck ?? 0)
    : (cameraState?.metrics?.truck_count ?? 0);

  const trafficState = isAnalyzing && liveTelemetry
    ? liveTelemetry.traffic_state
    : (cameraState?.metrics?.traffic_state ?? 'LOW');

  const flowRate = isAnalyzing && liveTelemetry
    ? liveTelemetry.arrival_rate
    : (cameraState?.metrics?.flow_rate_per_min ?? 0);

  const queueLength = isAnalyzing && liveTelemetry
    ? liveTelemetry.queue
    : (cameraState?.prediction?.future_queue_estimate ?? 0);

  const movementsData = isAnalyzing && liveTelemetry && liveTelemetry.movement_counts
    ? Object.entries(liveTelemetry.movement_counts).map(([mId, count]) => ({
        movement_id: parseInt(mId, 10),
        count: count as number,
        movement_description: `Movement ${mId}`,
        car_count: 0,
        truck_count: 0,
        flow_rate_per_min: 0,
        state: 'LOW' as any
      }))
    : (cameraState?.metrics?.by_movement ?? []);

  const videoSrc = api.getVideoUrl(currentSource.videoUrl);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ========================================================================= */}
      {/* 1. CONTROL HEADER BAR: FEED SOURCE DROPDOWN & ACTIONS */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* FEED SOURCE SELECTOR */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-cyan-950/80 border border-cyan-500/40 rounded-xl text-cyan-400">
                <VideoIcon className="w-5 h-5" />
              </div>
              <label htmlFor="feed-source-select" className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
                FEED SOURCE:
              </label>
            </div>

            <div className="relative">
              <select
                id="feed-source-select"
                value={selectedSourceId}
                onChange={(e) => setSelectedSourceId(e.target.value)}
                disabled={isAnalyzing}
                className="appearance-none bg-slate-950 border border-slate-700/80 hover:border-cyan-500/60 text-slate-100 text-sm font-semibold rounded-2xl pl-4 pr-10 py-2.5 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-all shadow-inner cursor-pointer"
              >
                {FEED_SOURCES.map((source) => (
                  <option key={source.id} value={source.id} className="bg-slate-950 text-slate-100 py-1">
                    {source.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-cyan-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {currentSource.hasGt && (
              <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Ground Truth Verified
              </span>
            )}
          </div>

          {/* ACTION BUTTONS & GPU BADGE */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs font-mono text-slate-300">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>{gpuAvailable ? 'CUDA FP16 (RTX 3050)' : 'CPU Mode'}</span>
            </div>

            <button
              onClick={handleStartInference}
              disabled={isAnalyzing}
              className={`flex items-center px-5 py-2.5 rounded-2xl text-xs font-bold font-mono uppercase tracking-wider transition-all shadow-lg ${
                isAnalyzing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/25 active:scale-95'
              }`}
            >
              <Zap className={`w-4 h-4 mr-2 ${isAnalyzing ? 'animate-spin text-slate-400' : 'fill-current'}`} />
              {isAnalyzing ? 'Processing on GPU...' : 'RUN GPU ANALYSIS'}
            </button>

            <label className="inline-flex items-center px-4 py-2.5 text-xs font-semibold text-cyan-300 bg-cyan-950/70 border border-cyan-700/60 rounded-2xl hover:bg-cyan-900/60 cursor-pointer transition-all shadow-md">
              <Upload className="w-4 h-4 mr-1.5" />
              Upload Source
              <input type="file" accept="video/mp4,video/avi" onChange={handleFileUpload} disabled={isAnalyzing} className="hidden" />
            </label>

            <button
              onClick={() => {
                api.getCameraTraffic(selectedSourceId).then(setCameraState).catch(() => {});
                onRefresh();
              }}
              title="Refresh Telemetry"
              className="p-2.5 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded-2xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* REAL-TIME PROCESSING STATUS BANNER */}
        {statusMessage && (
          <div className="mt-4 p-3 bg-cyan-950/70 border border-cyan-600/50 rounded-2xl flex items-center justify-between text-xs text-cyan-300 animate-fadeIn">
            <div className="flex items-center space-x-2 font-mono">
              <Activity className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>{statusMessage}</span>
            </div>
            {liveTelemetry && (
              <span className="font-bold text-cyan-400 font-mono">
                Frame {liveTelemetry.frame_index} / 600 • Speed: {liveTelemetry.processing_fps} FPS
              </span>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT: LARGE VIDEO PLAYER + REAL-TIME DASHBOARD */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: LARGE VIDEO PLAYER (7 of 12 columns) */}
        <div className="lg:col-span-7 space-y-4">
          <div
            ref={videoContainerRef}
            className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center group"
          >
            {videoError ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <AlertTriangle className="w-10 h-10 text-amber-400 mb-3" />
                <p className="text-base font-semibold text-slate-200">Video Stream Offline</p>
                <p className="text-xs text-slate-500 mb-4">{currentSource.name}</p>
                <button
                  onClick={() => {
                    setVideoError(false);
                    if (videoRef.current) videoRef.current.load();
                  }}
                  className="inline-flex items-center px-4 py-2 text-xs font-medium text-cyan-400 bg-cyan-950/70 border border-cyan-800 rounded-xl hover:bg-cyan-900 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload Video
                </button>
              </div>
            ) : isAnalyzing && activeJobId ? (
              /* LIVE STREAMING MJPEG CANVAS DURING GPU PROCESSING */
              <img
                src={api.getLiveStreamUrl(activeJobId)}
                alt={`Live GPU Inference Stream for ${currentSource.name}`}
                className="w-full h-full object-contain"
                onError={() => setVideoError(true)}
              />
            ) : (
              /* STANDARD VIDEO PLAYBACK */
              <video
                ref={videoRef}
                key={`video-${selectedSourceId}`}
                src={videoSrc}
                autoPlay
                loop
                muted
                controls
                playsInline
                className="w-full h-full object-contain"
                onError={() => setVideoError(true)}
              />
            )}

            {/* TOP HUD BADGES */}
            <div className="absolute top-4 left-4 flex items-center space-x-2 pointer-events-none">
              <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-black/80 text-cyan-400 border border-cyan-900/60 backdrop-blur-md">
                {selectedSourceId.toUpperCase()}
              </span>
              {isAnalyzing ? (
                <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-cyan-950/90 text-cyan-300 border border-cyan-500/60 backdrop-blur-md animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block mr-1.5 animate-ping"></span>
                  LIVE GPU INFERENCE
                </span>
              ) : (
                <span className="px-2.5 py-1 text-xs font-mono font-medium rounded-lg bg-black/70 text-slate-300 border border-slate-700/50 backdrop-blur-md">
                  PLAYBACK READY
                </span>
              )}
            </div>

            {/* FULLSCREEN BUTTON */}
            <button
              onClick={handleFullscreen}
              title="Fullscreen Video"
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/90 text-slate-300 hover:text-slate-100 rounded-xl backdrop-blur-md border border-slate-700/60 transition-all opacity-0 group-hover:opacity-100"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* VIDEO INFO FOOTER */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
            <div>
              <span className="text-slate-500 uppercase">Active Source:</span>{' '}
              <strong className="text-slate-200">{currentSource.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 uppercase">Model:</span>{' '}
              <span className="text-cyan-400">YOLOv8n Tensor Core FP16 + ByteTrack</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: REAL-TIME TRAFFIC METRICS (5 of 12 columns) */}
        <div className="lg:col-span-5 space-y-4">
          {/* METRIC CARDS GRID */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Vehicles Counted"
              value={totalVehicles}
              subtext={`Cars: ${carCount} • Trucks: ${truckCount}`}
              variant="highlight"
            />
            <MetricCard
              label="Traffic State"
              value={trafficState}
              subtext="Deterministic Classifier"
              variant={trafficState === 'CRITICAL' ? 'critical' : 'default'}
            />
            <MetricCard
              label="Flow Volume"
              value={flowRate.toFixed(1)}
              unit="veh/min"
              subtext="Rolling Arrival Rate"
              variant={flowRate > 25 ? 'critical' : 'default'}
            />
            <MetricCard
              label="Estimated Queue"
              value={queueLength}
              unit="veh"
              subtext="Physical Queue Length"
              variant={queueLength > 40 ? 'critical' : 'default'}
            />
          </div>

          {/* TURN MOVEMENT BREAKDOWN (AIC21 MOI) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center">
                <Compass className="w-4 h-4 mr-1.5 text-cyan-400" />
                Movement Flow Distribution
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {movementsData.length} Movements
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                {movementsData.length > 0 ? (
                  movementsData.map((m) => (
                    <div
                      key={m.movement_id}
                      className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <span className="text-cyan-400 font-bold block text-[11px]">Mov {m.movement_id}</span>
                        <span className="text-slate-400 text-[10px] truncate block font-sans">{m.movement_description}</span>
                      </div>
                      <div className="text-right ml-2 shrink-0">
                        <span className="text-sm font-bold text-slate-100">{m.count}</span>
                        <span className="text-[10px] text-slate-400 block">veh</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 py-4 text-center text-slate-500 font-sans text-xs">
                    No movement counts recorded for this source.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI COUNTERFACTUAL RECOMMENDATION */}
          {cameraState?.recommendation && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center space-x-2 text-cyan-400 mb-2">
                <Sliders className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
                  Adaptive Signal Insight
                </h3>
              </div>

              <div className="p-3 bg-cyan-950/60 border border-cyan-600/40 rounded-xl mb-3">
                <div className="text-[10px] uppercase tracking-wider text-cyan-300 font-bold mb-0.5">Recommended Action</div>
                <p className="text-xs font-semibold text-slate-100 leading-snug">{cameraState.recommendation.action}</p>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2">
                <span>Confidence: <strong className="text-cyan-400">{Math.round((cameraState.recommendation.confidence || 0.9) * 100)}%</strong></span>
                <span className="text-emerald-400 font-semibold">{cameraState.recommendation.predicted_queue_change_pct}% Queue</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
