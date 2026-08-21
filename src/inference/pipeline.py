"""
src/inference/pipeline.py
--------------------------
Full TrafficTwin inference pipeline.

Flow:
  INPUT VIDEO
      ↓ Video validation
      ↓ Frame iteration (cv2, in-memory)
      ↓ ROI loading
      ↓ YOLOv8n detection + ByteTrack tracking
      ↓ TrackStore trajectory recording
      ↓ ROI-exit movement assignment
      ↓ Vehicle counting (per class, per movement)
      ↓ Traffic feature extraction (rolling window)
      ↓ Traffic-state estimation (LOW/MEDIUM/HIGH/CRITICAL)
      ↓ Annotated video output (optional)
      ↓ JSON result output

Usage:
  from src.inference.pipeline import TrafficPipeline
  pipeline = TrafficPipeline(config_path="configs/config.yaml")
  result = pipeline.run(video_path="...", camera_id="cam_5")
"""

import json
import logging
import subprocess
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import yaml

from src.data.annotation_loader import (
    CameraAnnotation,
    ROIPolygon,
    load_all_movements,
    load_all_rois,
    load_counting_gt,
    summarize_gt,
)
from src.data.video_loader import get_video_info, iter_frames, validate_video
from src.tracking.tracker import ByteTracker, TrackStore
from src.movement.movement_assigner import MovementAssigner
from src.counting.roi_counter import VehicleCounter
from src.analytics.traffic_state import TrafficStateEstimator, TrafficState
from src.inference.visualizer import (
    create_video_writer,
    draw_count_panel,
    draw_roi,
    draw_tracks,
    draw_traffic_state_banner,
)

log = logging.getLogger(__name__)


def finalize_browser_video(raw_video_path: Path) -> Tuple[bool, str]:
    """
    Converts OpenCV generated video to browser-compatible H.264 MP4 with +faststart
    and validates readability, frame count, and dimensions.
    """
    if not raw_video_path.exists() or raw_video_path.stat().st_size == 0:
        return False, "Raw video file was not generated or is 0 bytes."

    try:
        import imageio_ffmpeg
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:
        ffmpeg_exe = None

    if ffmpeg_exe and Path(ffmpeg_exe).exists():
        temp_out = raw_video_path.parent / f"temp_{raw_video_path.name}"
        cmd = [
            ffmpeg_exe, "-y",
            "-i", str(raw_video_path),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-movflags", "+faststart",
            str(temp_out)
        ]
        log.info(f"Converting video to browser-compatible H.264: {raw_video_path.name}")
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode == 0 and temp_out.exists() and temp_out.stat().st_size > 0:
            try:
                raw_video_path.unlink(missing_ok=True)
                temp_out.rename(raw_video_path)
                log.info(f"Browser H.264 video finalized: {raw_video_path} ({raw_video_path.stat().st_size} bytes)")
            except Exception as e:
                log.warning(f"File rename exception: {e}")
        else:
            log.warning(f"FFmpeg conversion failed, retaining raw file: {proc.stderr}")
            if temp_out.exists():
                temp_out.unlink(missing_ok=True)

    # Validate output with OpenCV
    cap = cv2.VideoCapture(str(raw_video_path))
    if not cap.isOpened():
        return False, "Converted video cannot be opened by OpenCV decoder"

    fc = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    ret, frame = cap.read()
    cap.release()

    if fc <= 0 or w <= 0 or h <= 0 or not ret:
        return False, f"Invalid video stream: frames={fc}, w={w}, h={h}, first_frame={'OK' if ret else 'FAIL'}"

    return True, "OK"


class TrafficPipeline:
    """
    End-to-end TrafficTwin pipeline.

    Accepts one video + camera_id and returns structured results.
    """

    def __init__(self, config_path: str = "configs/config.yaml"):
        with open(config_path, "r") as f:
            self.cfg = yaml.safe_load(f)

        # Resolve key paths from config
        p = self.cfg["paths"]
        self.roi_dir = Path(p["roi_dir"])
        self.movement_dir = Path(p["movement_dir"])
        self.gt_dir = Path(p.get("gt_dir", ""))
        self.output_dir = Path(p["outputs_dir"])
        self.models_dir = Path(p["models_dir"])

        det_cfg = self.cfg["detection"]
        track_cfg = self.cfg["tracking"]
        count_cfg = self.cfg["counting"]
        intel_cfg = self.cfg["intelligence"]
        infer_cfg = self.cfg["inference"]
        hw_cfg = self.cfg["hardware"]

        self.device = hw_cfg.get("device", "cuda")
        self.frame_skip = infer_cfg.get("frame_skip", 0)
        self.max_frames = infer_cfg.get("max_frames", None)
        self.save_video = infer_cfg.get("save_annotated_video", True)
        self.save_json = infer_cfg.get("save_json_results", True)
        self.video_fps_out = infer_cfg.get("annotated_video_fps", 10)

        # Model path: use existing if available
        model_path = det_cfg.get("model_path") or None
        if model_path is None:
            # Check known location from hardware scan
            fallback = Path("D:/Dinesh project/New folder (2)/yolov8n.pt")
            if fallback.exists():
                model_path = str(fallback)
                log.info(f"Using existing model: {model_path}")

        # Tracker (also handles detection)
        self.tracker = ByteTracker(
            model_path=model_path,
            confidence=det_cfg["confidence_threshold"],
            iou_threshold=det_cfg["iou_threshold"],
            input_size=det_cfg["input_size"],
            device=self.device,
            track_buffer=track_cfg.get("track_buffer", 30),
        )

        # Load all annotations
        self.all_rois: Dict[str, ROIPolygon] = load_all_rois(self.roi_dir)
        self.all_movements: Dict[str, CameraAnnotation] = load_all_movements(self.movement_dir)

        # Intelligence config
        self.intelligence_window = intel_cfg.get("time_window_seconds", 60)
        self.intel_thresholds = intel_cfg.get("thresholds", {})
        self.imbalance_threshold = intel_cfg.get("direction_imbalance", {}).get("imbalance_threshold", 3.0)

        # ROI Filtering config
        roi_cfg = self.cfg.get("roi_filtering", {})
        self.border_margin = float(roi_cfg.get("roi_border_margin_pixels", 10.0))
        self.reference_point = str(roi_cfg.get("reference_point", "bottom_center"))
        self.show_outside_roi = bool(roi_cfg.get("show_outside_roi_detections", False))
        self.min_track_frames_confirm = int(roi_cfg.get("min_track_frames_confirm", 3))

        log.info(f"TrafficPipeline initialized (ROI margin={self.border_margin}px, ref={self.reference_point}, show_outside={self.show_outside_roi})")

    def run(
        self,
        video_path: str,
        camera_id: str,
        gt_csv_path: Optional[str] = None,
        output_prefix: Optional[str] = None,
        frame_callback=None,
    ) -> dict:
        """
        Run the full pipeline on one video.

        Args:
            video_path:   Path to the .mp4 file.
            camera_id:    Camera ID (e.g. "cam_5") — used to load ROI/movements.
            gt_csv_path:  Optional path to counting GT CSV for evaluation.
            output_prefix: Optional output filename prefix.
            frame_callback: Optional callback(annotated_frame, frame_id, timestamp_sec, summary_dict) for live streaming.

        Returns:
            Dict with full structured results.
        """
        video_path = Path(video_path)
        start_time = time.time()

        log.info("=" * 55)
        log.info(f"PIPELINE START: {video_path.name} | camera={camera_id}")
        log.info("=" * 55)

        # --- 1. Validate video ---
        valid, reason = validate_video(video_path)
        if not valid:
            raise RuntimeError(f"Video validation failed: {reason}")

        video_info = get_video_info(video_path)
        log.info(
            f"Video: {video_info.filename} | "
            f"{video_info.width}x{video_info.height} | "
            f"{video_info.fps:.1f}fps | "
            f"{video_info.frame_count} frames | "
            f"{video_info.duration_seconds:.1f}s"
        )

        # --- 2. Load annotations ---
        roi = self.all_rois.get(camera_id)
        cam_ann = self.all_movements.get(camera_id)

        if roi is None:
            raise ValueError(f"No ROI found for camera: {camera_id}")
        if cam_ann is None:
            raise ValueError(f"No movement description found for camera: {camera_id}")

        log.info(
            f"Annotations loaded | ROI vertices={len(roi.vertices)} | "
            f"movements={len(cam_ann.movements)}"
        )

        # --- 3. Initialize per-video components ---
        self.tracker.reset()
        track_store = TrackStore(max_trajectory_len=150)
        movement_assigner = MovementAssigner(
            roi=roi,
            camera_annotation=cam_ann,
            min_track_length=self.cfg["counting"]["min_track_length"],
            border_margin=self.border_margin,
            reference_point=self.reference_point,
        )
        counter = VehicleCounter(time_window_seconds=self.intelligence_window)
        state_estimator = TrafficStateEstimator(
            time_window_seconds=self.intelligence_window,
            thresholds=self.intel_thresholds,
            imbalance_threshold=self.imbalance_threshold,
        )

        # --- 4. Prepare output paths ---
        prefix = output_prefix or video_path.stem
        video_out_dir = Path(self.cfg["inference"]["video_output_dir"])
        metrics_dir = Path(self.cfg["inference"]["metrics_output_dir"])
        video_out_dir.mkdir(parents=True, exist_ok=True)
        metrics_dir.mkdir(parents=True, exist_ok=True)

        annotated_path = str(video_out_dir / f"{prefix}_annotated.mp4")

        # --- 5. Video writer ---
        writer = None
        if self.save_video:
            writer = create_video_writer(
                annotated_path,
                video_info.width,
                video_info.height,
                fps=min(video_info.fps, self.video_fps_out),
            )
            log.info(f"Annotated video → {annotated_path}")

        # --- 6. Main processing loop ---
        movement_descs = {mid: m.description for mid, m in cam_ann.movements.items()}
        all_frame_results = []
        traffic_state_snapshots = []
        state_update_interval = max(1, int(video_info.fps * 10))  # every 10 sec
        current_state = None
        frames_processed = 0
        total_active_tracks = 0

        log.info(f"Processing frames (frame_skip={self.frame_skip}, max_frames={self.max_frames})...")

        for frame_id, timestamp_sec, frame in iter_frames(
            video_path,
            frame_skip=self.frame_skip,
            max_frames=self.max_frames,
        ):
            t_frame_start = time.perf_counter()
            frames_processed += 1

            # --- Detection + Tracking ---
            tracks = self.tracker.track_frame(frame, frame_id, timestamp_sec)
            track_store.update(tracks)
            total_active_tracks += len(tracks)

            # --- Movement assignment + ROI Entry counting ---
            entry_events, exit_events = movement_assigner.process_frame(
                frame_id, timestamp_sec, track_store, tracks
            )
            counter.register_entries(entry_events)
            counter.register_exits(exit_events)

            # Feed exit events to intelligence layer
            for ev in exit_events:
                state_estimator.add_exit_event(
                    timestamp_sec, ev.movement_id, ev.aic21_class_name
                )

            # --- Traffic state (every 10 seconds of video time) ---
            if frames_processed % state_update_interval == 0 or frames_processed == 1:
                current_state = state_estimator.compute_state(
                    timestamp_sec, movement_descs
                )
                traffic_state_snapshots.append(current_state.to_dict())
                log.info(
                    f"  Frame {frame_id:5d} | t={timestamp_sec:6.1f}s | "
                    f"Tracks={len(tracks):3d} | "
                    f"Counted={counter.get_result().total:4d} | "
                    f"State={current_state.overall_state.value}"
                )

            # --- Frame result record ---
            count_snap = counter.get_result()
            all_frame_results.append({
                "frame_id": frame_id,
                "timestamp_sec": round(timestamp_sec, 2),
                "active_tracks": len(tracks),
                "total_counted": count_snap.total,
            })

            # --- Annotate and write frame ---
            if writer is not None or frame_callback is not None:
                annotated_frame = draw_roi(frame, roi)
                annotated_frame = draw_tracks(
                    annotated_frame,
                    tracks,
                    roi=roi,
                    show_outside_roi=self.show_outside_roi,
                    margin=self.border_margin,
                    reference_point=self.reference_point,
                )
                annotated_frame = draw_count_panel(
                    annotated_frame,
                    total=count_snap.total,
                    car_count=count_snap.by_class.get("Car", 0),
                    truck_count=count_snap.by_class.get("Truck", 0),
                    frame_id=frame_id,
                    timestamp_sec=timestamp_sec,
                    traffic_state=current_state.overall_state.value if current_state else None,
                )
                if current_state:
                    annotated_frame = draw_traffic_state_banner(annotated_frame, current_state)

                if writer is not None:
                    writer.write(annotated_frame)

                if frame_callback is not None:
                    try:
                        cur_dur_min = max(0.05, timestamp_sec / 60.0)
                        cur_flow = round(count_snap.total / cur_dur_min, 1)
                        cur_queue = min(85, max(2, int(cur_flow * 0.42)))
                        
                        live_payload = {
                            "job_id": prefix,
                            "frame_index": frame_id,
                            "total_frames": self.max_frames or video_info.frame_count,
                            "video_time_seconds": round(timestamp_sec, 2),
                            "vehicles_counted": count_snap.total,
                            "vehicle_classes": {
                                "Car": count_snap.by_class.get("Car", 0),
                                "Truck": count_snap.by_class.get("Truck", 0)
                            },
                            "movement_counts": {str(k): v for k, v in count_snap.by_movement.items()},
                            "traffic_state": current_state.overall_state.value if current_state else "LOW",
                            "arrival_rate": cur_flow,
                            "queue": cur_queue,
                            "processing_fps": round(1.0 / max(1e-4, time.perf_counter() - t_frame_start), 1),
                            "direction_imbalance": {
                                "detected": current_state.direction_imbalance.detected if current_state else False,
                                "ratio": current_state.direction_imbalance.ratio if current_state else 1.0,
                                "dominant_movement": current_state.direction_imbalance.dominant_movement if current_state else None
                            }
                        }
                        frame_callback(
                            annotated_frame,
                            frame_id,
                            timestamp_sec,
                            live_payload
                        )
                    except Exception as cb_err:
                        log.debug(f"Frame callback exception: {cb_err}")

        if writer:
            writer.release()
            log.info(f"OpenCV writer released for {annotated_path}")

        # Post-process and convert to browser-compatible H.264 MP4 with +faststart
        if self.save_video and Path(annotated_path).exists():
            success, msg = finalize_browser_video(Path(annotated_path))
            if not success:
                log.error(f"Video finalization warning: {msg}")
            else:
                log.info(f"Video validation verified: {annotated_path}")

        # --- 7. Final results ---
        elapsed = time.time() - start_time
        final_counts = counter.get_result()

        # Last traffic state
        if current_state is None:
            current_state = state_estimator.compute_state(
                frames_processed / video_info.fps, movement_descs
            )

        log.info(f"\n{counter.summary_str()}")
        log.info(f"Processing time: {elapsed:.1f}s for {frames_processed} frames")
        log.info(
            f"Speed: {frames_processed / elapsed:.1f} frames/sec"
            if elapsed > 0 else ""
        )

        result = {
            "video_id": video_path.stem,
            "camera_id": camera_id,
            "video_file": str(video_path),
            "video_info": {
                "width": video_info.width,
                "height": video_info.height,
                "fps": video_info.fps,
                "total_frames": video_info.frame_count,
                "duration_sec": video_info.duration_seconds,
            },
            "processing": {
                "frames_processed": frames_processed,
                "frame_skip": self.frame_skip,
                "processing_time_seconds": round(elapsed, 2),
                "speed_fps": round(frames_processed / elapsed, 1) if elapsed > 0 else 0,
                "device": self.device,
                "model": "YOLOv8n (COCO pretrained)",
                "tracker": "ByteTrack",
            },
            "total_vehicles": final_counts.total,
            "vehicle_classes": final_counts.by_class,
            "movement_counts": {str(k): v for k, v in final_counts.by_movement.items()},
            "movement_class_counts": {
                str(k): dict(v) for k, v in final_counts.by_movement_and_class.items()
            },
            "time_window_counts": final_counts.by_time_window,
            "traffic_state": current_state.overall_state.value if current_state else "UNKNOWN",
            "traffic_features": {
                "total_flow_rate_per_min": current_state.total_flow_rate_per_min
                    if current_state else 0,
                "direction_imbalance_detected": current_state.direction_imbalance.detected
                    if current_state else False,
                "direction_imbalance_ratio": current_state.direction_imbalance.ratio
                    if current_state else 1.0,
            },
            "traffic_state_history": traffic_state_snapshots[-10:],  # last 10 snapshots
            "outputs": {
                "annotated_video": annotated_path if self.save_video else None,
            },
        }

        # --- 8. Evaluation vs GT (if provided) ---
        if gt_csv_path:
            from src.evaluation.counting_eval import evaluate_counting, save_counting_results_csv
            gt_events = load_counting_gt(Path(gt_csv_path))
            # GT covers first 600 frames at 10fps
            eval_max_frame = max(e.frame_id for e in gt_events) if gt_events else 600
            eval_result = evaluate_counting(
                counter=counter,
                gt_events=gt_events,
                max_frame_id=eval_max_frame,
                camera_id=camera_id,
                fps=video_info.fps,
            )
            eval_result.print_report()
            result["evaluation"] = eval_result.to_dict()

            csv_path = metrics_dir / f"{prefix}_counting_results.csv"
            save_counting_results_csv(eval_result, csv_path)

        # --- 9. Save JSON ---
        if self.save_json:
            json_path = metrics_dir / f"{prefix}_results.json"
            with open(json_path, "w") as f:
                json.dump(result, f, indent=2, default=str)
            result["outputs"]["json_results"] = str(json_path)
            log.info(f"JSON results → {json_path}")

        log.info("=" * 55)
        log.info("PIPELINE COMPLETE")
        log.info("=" * 55)

        return result
