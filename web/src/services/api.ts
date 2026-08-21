import type { CurrentState, SimulationResult, Recommendation, CameraInfo } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

class TrafficApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async checkHealth(): Promise<{ status: string; gpu_available: boolean }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) throw new Error('Health check failed');
      return await res.json();
    } catch {
      return { status: 'offline', gpu_available: false };
    }
  }

  async getCurrentTraffic(): Promise<CurrentState> {
    const res = await fetch(`${this.baseUrl}/api/traffic/current`);
    if (!res.ok) throw new Error('Failed to fetch current traffic state from server');
    return await res.json();
  }

  async getCameras(): Promise<CameraInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/cameras`);
      if (!res.ok) throw new Error('Failed to fetch cameras');
      return await res.json();
    } catch {
      return [
        { camera_id: 'cam_5', name: 'Intersection 5 (Fisheye 4-Leg)', type: 'four-leg signalized', fps: 10.0, has_gt: true },
        { camera_id: 'cam_1', name: 'Intersection 1 (PTZ Angle)', type: 'three-leg signalized', fps: 10.0, has_gt: false },
        { camera_id: 'cam_7', name: 'Intersection 7 (Overhead Normal)', type: 'four-leg signalized', fps: 10.0, has_gt: false },
        { camera_id: 'cam_9', name: 'Camera 9 (Highway Ramp)', type: 'highway interchange', fps: 10.0, has_gt: false },
        { camera_id: 'cam_10', name: 'Camera 10 (Single Approach)', type: 'single-approach', fps: 10.0, has_gt: false }
      ];
    }
  }

  async startInference(cameraIdOrJobId: string = 'cam_5', maxFrames: number = 600): Promise<{ job_id: string; status: string }> {
    const formData = new FormData();
    formData.append('job_id', cameraIdOrJobId);
    formData.append('max_frames', maxFrames.toString());

    const res = await fetch(`${this.baseUrl}/api/inference/start`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to start inference');
    return await res.json();
  }

  async startAllInference(maxFrames: number = 600): Promise<{ status: string; message: string; jobs: Array<{ camera_id: string; job_id: string }> }> {
    const formData = new FormData();
    formData.append('max_frames', maxFrames.toString());

    const res = await fetch(`${this.baseUrl}/api/inference/start-all`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to start simultaneous multi-camera inference');
    return await res.json();
  }

  async uploadVideo(file: File, cameraId: string = 'cam_5'): Promise<{ job_id: string; filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('camera_id', cameraId);

    const res = await fetch(`${this.baseUrl}/api/video/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload video');
    return await res.json();
  }

  async getInferenceStatus(jobId: string) {
    const res = await fetch(`${this.baseUrl}/api/inference/${jobId}/status`);
    if (!res.ok) throw new Error('Failed to get job status');
    return await res.json();
  }

  async getJobResults(jobId: string) {
    const res = await fetch(`${this.baseUrl}/api/results/${jobId}`);
    if (!res.ok) throw new Error(`Failed to get results for job ${jobId}`);
    return await res.json();
  }

  async getDebugResults(jobId: string) {
    const res = await fetch(`${this.baseUrl}/api/debug/results/${jobId}`);
    if (!res.ok) throw new Error(`Failed to get debug results for job ${jobId}`);
    return await res.json();
  }

  async runSimulation(jobId: string = 'demo-cam5', strategies: string[] = ['current', '+10sec', '+20sec', '+30sec']): Promise<SimulationResult> {
    const res = await fetch(`${this.baseUrl}/api/simulation/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, strategies }),
    });
    if (!res.ok) throw new Error('Failed to run simulation');
    return await res.json();
  }

  async getRecommendation(): Promise<Recommendation> {
    const res = await fetch(`${this.baseUrl}/api/recommendation`);
    if (!res.ok) throw new Error('Failed to fetch recommendation');
    return await res.json();
  }

  getVideoUrl(pathOrUrl?: string): string {
    if (!pathOrUrl) return '';
    if (pathOrUrl.startsWith('http')) return pathOrUrl;
    return `${this.baseUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
  }

  getLiveStreamUrl(jobId: string): string {
    return `${this.baseUrl}/api/stream/${jobId}`;
  }

  getWsUrl(jobId: string): string {
    const wsProto = this.baseUrl.startsWith('https') ? 'wss' : 'ws';
    const host = this.baseUrl.replace(/^https?:\/\//, '');
    return `${wsProto}://${host}/ws/analysis/${jobId}`;
  }

  async getLiveAnalysisState(jobId: string) {
    const res = await fetch(`${this.baseUrl}/api/analysis/${jobId}/live`);
    if (!res.ok) throw new Error('Failed to get live analysis state');
    return await res.json();
  }

  async getCamerasOverview(): Promise<{ network_summary: any; cameras: any[] }> {
    try {
      const res = await fetch(`${this.baseUrl}/api/cameras/overview`);
      if (!res.ok) throw new Error('Failed to fetch cameras overview');
      return await res.json();
    } catch (err) {
      console.warn('Using fallback camera list:', err);
      return {
        network_summary: {
          total_cameras: 5,
          active_cameras: 5,
          analyzing_cameras: 1,
          monitoring_cameras: 4,
          total_vehicles: 137,
          critical_alerts: 2,
          avg_flow_rate: 26.8
        },
        cameras: [
          {
            camera_id: 'cam_5',
            cam_number: 'CAM 01',
            name: 'Intersection 5 (Fisheye 4-Leg) • (GT Verified)',
            subtitle: 'Fisheye 4-Leg',
            type: 'four-leg signalized',
            has_gt: true,
            status: 'LIVE',
            job_id: 'demo-cam5',
            vehicles_counted: 137,
            traffic_state: 'CRITICAL',
            flow_rate_per_min: 44.0,
            queue: 57,
            video_url: '/api/video/stream/cam5_eval_annotated.mp4',
            car_count: 135,
            truck_count: 2,
            fps: 10.0
          },
          {
            camera_id: 'cam_1',
            cam_number: 'CAM 02',
            name: 'Intersection 1 (PTZ Angle)',
            subtitle: 'PTZ Angle',
            type: 'three-leg signalized',
            has_gt: false,
            status: 'MONITORING',
            job_id: 'demo-cam_1',
            vehicles_counted: 3,
            traffic_state: 'MEDIUM',
            flow_rate_per_min: 3.0,
            queue: 8,
            video_url: '/api/video/stream/cam_1.mp4',
            car_count: 3,
            truck_count: 0,
            fps: 10.0
          },
          {
            camera_id: 'cam_7',
            cam_number: 'CAM 03',
            name: 'Intersection 7 (Overhead Normal)',
            subtitle: 'Overhead Normal',
            type: 'four-leg signalized',
            has_gt: false,
            status: 'MONITORING',
            job_id: 'demo-cam_7',
            vehicles_counted: 18,
            traffic_state: 'HIGH',
            flow_rate_per_min: 18.0,
            queue: 18,
            video_url: '/api/video/stream/cam_7.mp4',
            car_count: 18,
            truck_count: 0,
            fps: 10.0
          },
          {
            camera_id: 'cam_9',
            cam_number: 'CAM 04',
            name: 'Camera 9 (Highway Ramp)',
            subtitle: 'Highway Ramp',
            type: 'highway interchange',
            has_gt: false,
            status: 'MONITORING',
            job_id: 'demo-cam_9',
            vehicles_counted: 5,
            traffic_state: 'MEDIUM',
            flow_rate_per_min: 5.0,
            queue: 9,
            video_url: '/api/video/stream/cam_9.mp4',
            car_count: 5,
            truck_count: 0,
            fps: 10.0
          },
          {
            camera_id: 'cam_10',
            cam_number: 'CAM 05',
            name: 'Camera 10 (Single Approach)',
            subtitle: 'Single Approach',
            type: 'single-approach',
            has_gt: false,
            status: 'MONITORING',
            job_id: 'demo-cam_10',
            vehicles_counted: 64,
            traffic_state: 'CRITICAL',
            flow_rate_per_min: 64.0,
            queue: 52,
            video_url: '/api/video/stream/cam_10.mp4',
            car_count: 64,
            truck_count: 0,
            fps: 10.0
          }
        ]
      };
    }
  }

  async getCameraTraffic(cameraId: string): Promise<CurrentState> {
    const res = await fetch(`${this.baseUrl}/api/traffic/camera/${cameraId}`);
    if (!res.ok) throw new Error(`Failed to fetch traffic state for ${cameraId}`);
    return await res.json();
  }
}

export const api = new TrafficApiService();

