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
  by_movement: MovementCount[];
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

export interface LiveAnalysisState {
  job_id: string;
  frame_index: number;
  total_frames: number;
  video_time_seconds: number;
  vehicles_counted: number;
  vehicle_classes: {
    Car?: number;
    Truck?: number;
  };
  movement_counts: Record<string, number>;
  traffic_state: TrafficState;
  arrival_rate: number;
  queue: number;
  processing_fps: number;
  direction_imbalance?: {
    detected: boolean;
    ratio: number;
    dominant_movement?: number;
  };
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

