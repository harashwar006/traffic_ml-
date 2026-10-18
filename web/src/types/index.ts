// TrafficTwin Domain Models & API Types

export type TrafficState = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';

export type AnalysisStatus = 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'ANALYZING' | 'SIMULATING' | 'READY' | 'ERROR';

export interface MovementCount {
  movement_id: number;
  movement_description: string;
  count: number;
  car_count: number;
  truck_count: number;
  flow_rate_per_min: number;
  state: TrafficState;
}

export interface TrafficMetrics {
  traffic_state: TrafficState;
  total_vehicle_count: number;
  car_count: number;
  truck_count: number;
  flow_rate_per_min: number;
  timestamp_sec: number;
  frames_processed: number;
  direction_imbalance_detected: boolean;
  direction_imbalance_ratio: number;
  dominant_movement?: number;
  average_speed?: number;
  by_movement: MovementCount[];
  current_roi_count?: number;
  initial_occupancy?: number;
  cumulative_entries?: number;
  cumulative_exits?: number;
  invariant_verified?: boolean;
}

export interface TrafficPrediction {
  future_queue_estimate: number;
  future_congestion_pct: number;
  time_horizon_sec: number;
  confidence: number;
}

export interface HistoryPoint {
  timestamp_sec: number;
  frame_id: number;
  total_count: number;
  flow_rate_per_min: number;
  state: TrafficState;
}

export interface SimulationStrategy {
  strategy_id: string; // 'current' | '+10sec' | '+20sec' | '+30sec'
  label: string;
  green_phase_extension_sec: number;
  predicted_queue: number;
  predicted_wait_sec: number;
  predicted_congestion_pct: number;
  score: number;
  is_recommended: boolean;
}

export interface SimulationResult {
  job_id: string;
  strategies: SimulationStrategy[];
  recommended_strategy_id: string;
  simulation_completed: boolean;
}

export interface RecommendationFactor {
  factor: string;
  value: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  weight: 'high' | 'medium' | 'low';
}

export interface Recommendation {
  action: string;
  strategy_id: string;
  green_phase_extension_sec: number;
  reasoning: RecommendationFactor[];
  predicted_queue_change: number;
  predicted_queue_change_pct: number;
  predicted_wait_change_sec: number;
  predicted_congestion_change_pct: number;
  confidence: number;
}

export interface CurrentState {
  job_id?: string;
  status: AnalysisStatus;
  metrics?: TrafficMetrics;
  prediction?: TrafficPrediction;
  simulation?: SimulationResult;
  recommendation?: Recommendation;
  history: HistoryPoint[];
  camera_id?: string;
  video_name?: string;
  annotated_video_url?: string;
}

export interface CameraInfo {
  camera_id: string;
  name: string;
  type: string;
  fps: number;
  has_gt: boolean;
}

export interface RoadAnalytics {
  road_id: string;
  name: string;
  vehicles?: number;
  cumulative_vehicles?: number;
  cumulative_total?: number;
  current_active?: number;
  current_roi_count?: number;
  active_track_ids?: number[];
  current_moving?: number;
  current_stationary?: number;
  current_rest?: number;
  cumulative_entries?: number;
  cumulative_exits?: number;
  completed_trips?: number;
  valid_trips?: number;
  average_speed?: number | null;
  speed_display?: string;
  length_meters?: number;
  cars: number;
  trucks: number;
  buses?: number;
  motorcycles?: number;
  bicycles?: number;
  flow_volume?: number;
  queue?: number;
  traffic_state?: TrafficState;
}

export interface PerformanceMetrics {
  gpu_name: string;
  device: string;
  precision: string;
  vram_allocated_mb: number;
  vram_reserved_mb: number;
  vram_total_mb: number;
  cpu_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  decode_ms: number;
  preprocess_ms?: number;
  inference_ms: number;
  postprocess_ms?: number;
  tracking_ms: number;
  analytics_ms: number;
  render_ms: number;
  write_ms: number;
  total_latency_ms: number;
  processed_fps: number;
  source_fps: number;
  frames_processed: number;
  frames_skipped: number;
  inference_imgsz: number;
  flow_window_seconds?: number;
}


export interface LiveAnalysisState {
  job_id: string;
  frame_index: number;
  total_frames: number;
  video_time_seconds: number;
  timestamp_sec?: number;
  // Distinct counts: current visible vs cumulative unique
  current_active?: number;
  current_roi_count?: number;
  initial_occupancy?: number;
  cumulative_entries?: number;
  cumulative_exits?: number;
  invariant_verified?: boolean;
  current_moving?: number;
  current_stationary?: number;
  active_vehicles?: number;
  moving_vehicles?: number;
  stationary_vehicles?: number;
  vehicles_counted: number;
  vehicle_classes: {
    Car?: number;
    Truck?: number;
    Bus?: number;
    Motorcycle?: number;
    Bicycle?: number;
  };
  current_classes?: Record<string, number>;
  class_counts?: Record<string, number>;
  movement_counts: Record<string, number>;
  traffic_state: TrafficState;
  arrival_rate: number;
  flow_rate_per_min?: number;
  queue: number;
  average_speed?: number | null;
  completed_trips?: number;
  valid_trips?: number;
  speed_display?: string;
  processing_fps: number;
  direction_imbalance?: {
    detected: boolean;
    ratio: number;
    dominant_movement?: number;
  };
  // Multi-road analytics
  roads?: RoadAnalytics[];
  total_road_summary?: RoadAnalytics;
  global?: {
    vehicles: number;
    current_active?: number;
    current_moving?: number;
    current_stationary?: number;
    flow_volume: number;
    traffic_state: TrafficState;
    queue?: number;
    average_speed?: number;
  };
  // Real-time GPU & pipeline telemetry
  perf?: PerformanceMetrics;
  // Output video availability
  output_ready?: boolean;
  output_url?: string;
}

export interface CameraOverviewItem {
  camera_id: string;
  cam_number: string; // 'CAM 01', 'CAM 02', ...
  name: string;
  subtitle: string;
  type: string;
  has_gt: boolean;
  status: 'LIVE' | 'ANALYZING' | 'MONITORING' | 'COMPLETED' | 'OFFLINE' | 'ERROR';
  job_id: string;
  vehicles_counted: number;
  traffic_state: TrafficState;
  flow_rate_per_min: number;
  queue: number;
  video_url: string;
  car_count: number;
  truck_count: number;
  dominant_movement?: number;
  movement_counts: Record<string, number>;
  fps: number;
}

export interface NetworkSummary {
  total_cameras: number;
  active_cameras: number;
  analyzing_cameras: number;
  monitoring_cameras: number;
  total_vehicles: number;
  critical_alerts: number;
  avg_flow_rate: number;
}

export interface NetworkOverview {
  network_summary: NetworkSummary;
  cameras: CameraOverviewItem[];
}

export interface VideoSession {
  videoId: string;
  sessionId?: string;
  file?: File | null;
  videoName?: string;
  videoStatus: AnalysisStatus;
  processingProgress: number;
  roiPolygons: any[];
  activeTrackIds?: number[];
  currentROICount?: number;
  cumulativeEntries?: number;
  cumulativeExits?: number;
  roadAnalytics?: RoadAnalytics[];
  averageSpeed?: number | null;
  error?: string | null;
}


