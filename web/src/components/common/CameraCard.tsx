import React, { useRef, useState } from 'react';
import type { CameraOverviewItem, LiveAnalysisState } from '../../types';
import { TrafficStateBadge } from './TrafficStateBadge';
import { api } from '../../services/api';
import { Maximize2, Activity, RefreshCw, ZoomIn, ShieldCheck, AlertTriangle } from 'lucide-react';

interface CameraCardProps {
  camera: CameraOverviewItem;
  isSelected: boolean;
  onSelect: (cameraId: string) => void;
  onRunAnalysis: (cameraId: string) => void;
  onViewDetails: (cameraId: string) => void;
  liveTelemetry?: LiveAnalysisState | null;
  isAnalyzingThisCamera?: boolean;
}

export const CameraCard: React.FC<CameraCardProps> = ({
  camera,
  isSelected,
  onSelect,
  onRunAnalysis,
  onViewDetails,
  liveTelemetry,
  isAnalyzingThisCamera = false,
}) => {
  const [videoError, setVideoError] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Derived live values from WebSocket telemetry if analyzing, else static baseline
  const vehiclesCounted = isAnalyzingThisCamera && liveTelemetry
    ? liveTelemetry.vehicles_counted
    : camera.vehicles_counted;

  const trafficState = isAnalyzingThisCamera && liveTelemetry
    ? liveTelemetry.traffic_state
    : camera.traffic_state;

  const flowRate = isAnalyzingThisCamera && liveTelemetry
    ? liveTelemetry.arrival_rate
    : camera.flow_rate_per_min;

  const queueLength = isAnalyzingThisCamera && liveTelemetry
    ? liveTelemetry.queue
    : camera.queue;

  const isCritical = trafficState === 'CRITICAL';

  const handleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (cardRef.current) {
      if (!document.fullscreenElement) {
        cardRef.current.requestFullscreen().catch((err) => {
          console.warn('Fullscreen request failed:', err);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  const handleRetryVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVideoError(false);
    setRetryCount((prev) => prev + 1);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  const videoSrc = api.getVideoUrl(camera.video_url);

  return (
    <div
      ref={cardRef}
      onClick={() => onSelect(camera.camera_id)}
      className={`relative flex flex-col h-full rounded-xl transition-all duration-200 border overflow-hidden backdrop-blur-md cursor-pointer ${
        isSelected
          ? 'bg-slate-900/95 border-cyan-500 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-500/50'
          : isCritical
          ? 'bg-slate-900/90 border-rose-500/50 hover:border-rose-500 shadow-md shadow-rose-950/20'
          : 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700 shadow-md'
      }`}
    >
      {/* 1. ULTRA-COMPACT HEADER BAR */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-950/80 shrink-0">
        <div className="flex items-center space-x-2 min-w-0">
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 shrink-0">
            {camera.cam_number}
          </span>
          <h3 className="text-xs font-semibold text-slate-200 truncate">{camera.name}</h3>
          {camera.has_gt && (
            <span className="hidden sm:inline-flex items-center px-1 py-0.2 text-[9px] font-medium rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> GT
            </span>
          )}
        </div>

        {/* STATUS & ACTIONS */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {isAnalyzingThisCamera ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/70 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1 animate-ping"></span>
              GPU PROCESSING
            </span>
          ) : isCritical ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-600/50">
              <AlertTriangle className="w-2.5 h-2.5 mr-1 text-rose-400" />
              CRITICAL
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <span className="w-1 h-1 rounded-full bg-emerald-400 mr-1"></span>
              LIVE
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(camera.camera_id);
            }}
            title="Zoom / Inspect"
            className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleFullscreen}
            title="Fullscreen"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. VIDEO VIEWPORT */}
      <div className="relative flex-1 min-h-0 bg-slate-950 overflow-hidden flex items-center justify-center group">
        {videoError ? (
          <div className="flex flex-col items-center justify-center p-3 text-center text-slate-400">
            <AlertTriangle className="w-6 h-6 text-amber-400 mb-1" />
            <p className="text-xs font-semibold text-slate-300">Feed Offline</p>
            <button
              onClick={handleRetryVideo}
              className="mt-1 inline-flex items-center px-2 py-1 text-[10px] font-medium text-cyan-400 bg-cyan-950/60 border border-cyan-800 rounded hover:bg-cyan-900 transition-colors"
            >
              <RefreshCw className="w-2.5 h-2.5 mr-1" /> Retry
            </button>
          </div>
        ) : isAnalyzingThisCamera && camera.job_id ? (
          <img
            key={`stream-${camera.job_id}-${retryCount}`}
            src={api.getLiveStreamUrl(camera.job_id)}
            alt={`Live stream ${camera.name}`}
            className="w-full h-full object-contain"
            onError={() => setVideoError(true)}
          />
        ) : (
          <video
            ref={videoRef}
            key={`video-${camera.camera_id}-${retryCount}`}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain"
            onError={() => setVideoError(true)}
          />
        )}

        {/* TOP HUD BADGES */}
        <div className="absolute top-1.5 left-1.5 flex items-center space-x-1 pointer-events-none">
          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-black/75 text-slate-300 border border-slate-700/50 backdrop-blur-sm">
            {camera.fps} FPS
          </span>
          {isAnalyzingThisCamera && liveTelemetry && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-cyan-950/90 text-cyan-300 border border-cyan-600/60 backdrop-blur-sm">
              F#{liveTelemetry.frame_index}
            </span>
          )}
        </div>

        {/* BOTTOM TRANSLUCENT HUD OVERLAY (METRICS BAR) */}
        <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 backdrop-blur-md px-2.5 py-1 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-3">
            <span className="flex items-center font-mono">
              <span className="text-[10px] text-slate-400 uppercase mr-1">Veh:</span>
              <strong className="text-cyan-400 text-xs">{vehiclesCounted}</strong>
            </span>

            <div className="flex items-center">
              <TrafficStateBadge state={trafficState} size="sm" />
            </div>

            <span className="hidden sm:flex items-center font-mono text-[11px] text-slate-300">
              <span className="text-[10px] text-slate-400 uppercase mr-1">Flow:</span>
              <strong>{flowRate.toFixed(1)}</strong>
              <span className="text-[9px] text-slate-400 ml-0.5">/min</span>
            </span>

            <span className="hidden md:flex items-center font-mono text-[11px]">
              <span className="text-[10px] text-slate-400 uppercase mr-1">Q:</span>
              <strong className={isCritical ? 'text-rose-400' : 'text-amber-400'}>{queueLength}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRunAnalysis(camera.camera_id);
              }}
              disabled={isAnalyzingThisCamera}
              title="Run GPU Analysis on this camera"
              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                isAnalyzingThisCamera
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 hover:border-cyan-500'
              }`}
            >
              <Activity className="w-2.5 h-2.5 inline mr-1 text-cyan-400" />
              {isAnalyzingThisCamera ? 'Running' : 'Analyze'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
