"""
src/tracking/tracker.py
------------------------
ByteTrack-based multi-object tracker for AIC21 vehicle tracking.
Uses ultralytics built-in tracker (no additional install required).

Each vehicle gets a persistent track_id that survives brief occlusions.
Trajectory history is maintained in TrackStore.
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
from ultralytics import YOLO

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class Track:
    """A single tracked vehicle on a specific frame."""
    track_id: int
    frame_id: int
    timestamp_sec: float
    aic21_class_name: str        # "Car", "Truck", "Motorcycle"
    aic21_class_id: int
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def center_x(self) -> float:
        return (self.x1 + self.x2) / 2

    @property
    def center_y(self) -> float:
        return (self.y1 + self.y2) / 2

    @property
    def bottom_center(self) -> Tuple[float, float]:
        """Vehicle contact point with the road: ((x1 + x2)/2, y2)."""
        return ((self.x1 + self.x2) / 2.0, float(self.y2))

    def is_inside_roi(self, roi, margin: float = 10.0, reference_point: str = "bottom_center") -> bool:
        if roi is None:
            return True
        if reference_point == "bottom_center":
            return roi.contains_bottom_center(self.x1, self.y1, self.x2, self.y2, margin=margin)
        return roi.contains_point(self.center_x, self.center_y, margin=margin)

    def is_countable(self) -> bool:
        return self.aic21_class_name in ("Car", "Truck")

    def to_dict(self) -> dict:
        return {
            "track_id": self.track_id,
            "frame_id": self.frame_id,
            "timestamp_sec": round(self.timestamp_sec, 3),
            "aic21_class_name": self.aic21_class_name,
            "aic21_class_id": self.aic21_class_id,
            "confidence": round(self.confidence, 4),
            "x1": round(self.x1, 1),
            "y1": round(self.y1, 1),
            "x2": round(self.x2, 1),
            "y2": round(self.y2, 1),
            "center_x": round(self.center_x, 1),
            "center_y": round(self.center_y, 1),
        }


# ---------------------------------------------------------------------------
# TrackStore — persistent trajectory memory
# ---------------------------------------------------------------------------

class TrackStore:
    """
    Stores the trajectory (sequence of positions) for every track_id.
    Used by movement assigner and ROI counter to determine exit direction.
    """

    def __init__(self, max_trajectory_len: int = 150):
        """
        Args:
            max_trajectory_len: Maximum number of positions stored per track.
                                Older positions are discarded (FIFO).
        """
        self.max_len = max_trajectory_len
        # {track_id: [(frame_id, cx, cy), ...]}
        self._trajectories: Dict[int, List[Tuple[int, float, float]]] = {}
        # {track_id: class_name}  — most recently seen class
        self._classes: Dict[int, str] = {}
        # {track_id: bool}  — has this track been counted?
        self._counted: Dict[int, bool] = {}
        # {track_id: int}  — assigned movement_id at time of counting
        self._movement: Dict[int, Optional[int]] = {}

    def update(self, tracks: List[Track]) -> None:
        """Register new track observations for this frame."""
        for t in tracks:
            if t.track_id not in self._trajectories:
                self._trajectories[t.track_id] = []
                self._counted[t.track_id] = False
                self._movement[t.track_id] = None
            traj = self._trajectories[t.track_id]
            traj.append((t.frame_id, t.center_x, t.center_y))
            if len(traj) > self.max_len:
                traj.pop(0)
            self._classes[t.track_id] = t.aic21_class_name

    def get_trajectory(self, track_id: int) -> List[Tuple[int, float, float]]:
        """Return [(frame_id, cx, cy), ...] for a track_id."""
        return self._trajectories.get(track_id, [])

    def get_last_positions(self, track_id: int, n: int = 5) -> List[Tuple[float, float]]:
        """Return the last N (cx, cy) positions of a track."""
        traj = self._trajectories.get(track_id, [])
        return [(p[1], p[2]) for p in traj[-n:]]

    def get_class(self, track_id: int) -> str:
        return self._classes.get(track_id, "Unknown")

    def is_counted(self, track_id: int) -> bool:
        return self._counted.get(track_id, False)

    def mark_counted(self, track_id: int, movement_id: Optional[int] = None) -> None:
        self._counted[track_id] = True
        self._movement[track_id] = movement_id

    def get_movement(self, track_id: int) -> Optional[int]:
        return self._movement.get(track_id, None)

    def track_length(self, track_id: int) -> int:
        return len(self._trajectories.get(track_id, []))

    def all_track_ids(self) -> List[int]:
        return list(self._trajectories.keys())

    def active_track_ids(self, current_frame_id: int, max_age: int = 30) -> List[int]:
        """Return track IDs seen within the last max_age frames."""
        active = []
        for tid, traj in self._trajectories.items():
            if traj and (current_frame_id - traj[-1][0]) <= max_age:
                active.append(tid)
        return active


# ---------------------------------------------------------------------------
# ByteTracker — wraps ultralytics YOLO tracker
# ---------------------------------------------------------------------------

# COCO IDs for vehicles (must match detector)
TARGET_COCO_IDS = {2, 3, 5, 7}
COCO_TO_AIC21 = {2: "Car", 5: "Car", 7: "Truck", 3: "Motorcycle"}
AIC21_CLASS_ID = {"Car": 1, "Truck": 2, "Motorcycle": 0}


class ByteTracker:
    """
    Wraps ultralytics model.track() to provide ByteTrack.
    Returns List[Track] per frame, with persistent track_ids.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence: float = 0.35,
        iou_threshold: float = 0.45,
        input_size: int = 640,
        device: Optional[str] = None,
        track_buffer: int = 30,
        use_half: Optional[bool] = None,
    ):
        if device is None or device == "cuda":
            if torch.cuda.is_available():
                device = "cuda:0"
            else:
                device = "cpu"
        self.device = str(device)
        self.confidence = confidence
        self.iou_threshold = iou_threshold
        self.input_size = input_size
        self.track_buffer = track_buffer
        self.half = use_half if use_half is not None else ("cuda" in self.device)

        if model_path and Path(model_path).exists():
            log.info(f"Loading tracker model from: {model_path}")
            self.model = YOLO(model_path)
        else:
            log.info("Using yolov8n.pt for tracking")
            self.model = YOLO("yolov8n.pt")

        self.model.to(self.device)
        self._frame_count = 0

        # GPU Warmup
        try:
            dummy = np.zeros((self.input_size, self.input_size, 3), dtype=np.uint8)
            self.model.predict(dummy, imgsz=self.input_size, device=self.device, half=self.half, verbose=False)
            log.info(
                f"[GPU] ByteTracker ready | device={self.device} (half={self.half}) | "
                f"GPU={torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'N/A'}"
            )
        except Exception as e:
            log.warning(f"Tracker warmup exception: {e}")

    def track_frame(
        self,
        frame: np.ndarray,
        frame_id: int = 0,
        timestamp_sec: float = 0.0,
    ) -> List[Track]:
        """
        Run detection + ByteTrack on a single frame on GPU.

        Args:
            frame:         BGR numpy array.
            frame_id:      Original frame index in the video.
            timestamp_sec: Time offset in seconds.

        Returns:
            List of Track objects with persistent track_ids.
        """
        results = self.model.track(
            frame,
            conf=self.confidence,
            iou=self.iou_threshold,
            imgsz=self.input_size,
            device=self.device,
            half=self.half,
            persist=True,                    # CRITICAL: keep track state across calls
            verbose=False,
            classes=list(TARGET_COCO_IDS),
            tracker="bytetrack.yaml",        # use ByteTrack config
        )

        tracks = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
            if boxes.id is None:
                # No tracked IDs yet (first few frames)
                continue
            for box in boxes:
                if box.id is None:
                    continue
                coco_id = int(box.cls.item())
                if coco_id not in TARGET_COCO_IDS:
                    continue
                aic21_name = COCO_TO_AIC21[coco_id]
                xyxy = box.xyxy[0].tolist()
                tracks.append(Track(
                    track_id=int(box.id.item()),
                    frame_id=frame_id,
                    timestamp_sec=timestamp_sec,
                    aic21_class_name=aic21_name,
                    aic21_class_id=AIC21_CLASS_ID[aic21_name],
                    confidence=float(box.conf.item()),
                    x1=xyxy[0],
                    y1=xyxy[1],
                    x2=xyxy[2],
                    y2=xyxy[3],
                ))

        self._frame_count += 1
        return tracks

    def reset(self) -> None:
        """Reset tracker state (call between different videos)."""
        self._frame_count = 0
        # Reset YOLO tracker internal state
        if hasattr(self.model, "predictor") and self.model.predictor is not None:
            if hasattr(self.model.predictor, "trackers"):
                self.model.predictor.trackers = None
        log.debug("Tracker state reset.")
