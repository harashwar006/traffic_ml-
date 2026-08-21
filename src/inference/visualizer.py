"""
src/inference/visualizer.py
-----------------------------
Annotates video frames with:
  - Vehicle bounding boxes (color-coded by class)
  - Track IDs
  - Vehicle class labels
  - ROI polygon overlay
  - Traffic state display
  - Real-time counts

All drawing uses OpenCV — no external dependencies.
"""

import logging
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

from src.data.annotation_loader import ROIPolygon
from src.tracking.tracker import Track
from src.analytics.traffic_state import IntersectionTrafficState, TrafficState

log = logging.getLogger(__name__)

# Color palette (BGR format)
COLORS = {
    "Car":       (0, 220, 0),       # green
    "Truck":     (0, 165, 255),     # orange
    "Motorcycle": (200, 200, 200),  # grey
    "Unknown":   (180, 180, 180),
    "roi":       (0, 255, 255),     # yellow
    TrafficState.LOW:      (0, 200, 0),     # green
    TrafficState.MEDIUM:   (0, 165, 255),   # orange
    TrafficState.HIGH:     (0, 0, 255),     # red
    TrafficState.CRITICAL: (128, 0, 255),   # purple
    TrafficState.UNKNOWN:  (150, 150, 150),
}

FONT = cv2.FONT_HERSHEY_SIMPLEX


def draw_roi(
    frame: np.ndarray,
    roi: ROIPolygon,
    alpha: float = 0.15,
) -> np.ndarray:
    """Draw semi-transparent ROI polygon on frame."""
    pts = roi.numpy_vertices().reshape((-1, 1, 2))

    # Semi-transparent fill
    overlay = frame.copy()
    cv2.fillPoly(overlay, [pts], COLORS["roi"])
    frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

    # Solid boundary
    cv2.polylines(frame, [pts], isClosed=True, color=COLORS["roi"], thickness=2)
    return frame


def draw_tracks(
    frame: np.ndarray,
    tracks: List[Track],
    roi: Optional[ROIPolygon] = None,
    show_outside_roi: bool = False,
    margin: float = 10.0,
    reference_point: str = "bottom_center",
    show_track_id: bool = True,
    show_class: bool = True,
    thickness: int = 2,
    font_scale: float = 0.55,
) -> np.ndarray:
    """
    Draw bounding boxes and labels for tracks.
    In Traffic Analysis Mode (show_outside_roi=False), only tracks whose reference
    point is within the valid ROI polygon (accounting for border margin) are drawn.
    """
    for track in tracks:
        inside = True
        if roi is not None:
            inside = track.is_inside_roi(roi, margin=margin, reference_point=reference_point)

        if not inside and not show_outside_roi:
            continue

        color = COLORS.get(track.aic21_class_name, COLORS["Unknown"])
        if not inside:
            color = (120, 120, 120)  # subtle grey for outside ROI debug mode

        x1, y1, x2, y2 = int(track.x1), int(track.y1), int(track.x2), int(track.y2)

        # Bounding box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

        # Label
        parts = []
        if show_track_id:
            parts.append(f"#{track.track_id}")
        if show_class:
            parts.append(track.aic21_class_name[:3])  # Car / Tru / Mot
        parts.append(f"{track.confidence:.2f}")
        label = " ".join(parts)

        # Background for label
        (tw, th), _ = cv2.getTextSize(label, FONT, font_scale, 1)
        label_y = max(y1 - 4, th + 4)
        cv2.rectangle(frame, (x1, label_y - th - 4), (x1 + tw + 4, label_y + 2), color, -1)
        cv2.putText(frame, label, (x1 + 2, label_y - 2), FONT, font_scale, (0, 0, 0), 1, cv2.LINE_AA)

    return frame


def draw_count_panel(
    frame: np.ndarray,
    total: int,
    car_count: int,
    truck_count: int,
    frame_id: int,
    timestamp_sec: float,
    traffic_state: Optional[str] = None,
) -> np.ndarray:
    """Draw a count panel in the top-right corner."""
    h, w = frame.shape[:2]
    panel_w = 220
    panel_h = 120
    x_offset = w - panel_w - 10
    y_offset = 10

    # Panel background
    overlay = frame.copy()
    cv2.rectangle(overlay, (x_offset, y_offset),
                  (x_offset + panel_w, y_offset + panel_h), (0, 0, 0), -1)
    frame = cv2.addWeighted(overlay, 0.65, frame, 0.35, 0)

    # Text lines
    lines = [
        f"Frame: {frame_id}  T: {timestamp_sec:.1f}s",
        f"Total: {total}",
        f"  Cars:   {car_count}",
        f"  Trucks: {truck_count}",
    ]
    if traffic_state:
        lines.append(f"State: {traffic_state}")

    for i, line in enumerate(lines):
        color = (255, 255, 255)
        if line.startswith("State:"):
            state_val = line.split(":")[-1].strip()
            ts = TrafficState(state_val) if state_val in [s.value for s in TrafficState] else TrafficState.UNKNOWN
            color = COLORS.get(ts, (255, 255, 255))
        cv2.putText(
            frame, line,
            (x_offset + 8, y_offset + 18 + i * 20),
            FONT, 0.5, color, 1, cv2.LINE_AA
        )

    return frame


def draw_traffic_state_banner(
    frame: np.ndarray,
    state: IntersectionTrafficState,
) -> np.ndarray:
    """Draw a traffic state banner at the bottom of the frame."""
    h, w = frame.shape[:2]
    banner_h = 32
    y_start = h - banner_h

    ts = state.overall_state
    color = COLORS.get(ts, (100, 100, 100))

    # Background
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, y_start), (w, h), color, -1)
    frame = cv2.addWeighted(overlay, 0.75, frame, 0.25, 0)

    # Text
    text = (
        f"TRAFFIC: {ts.value}  |  "
        f"Flow: {state.total_flow_rate_per_min:.1f} veh/min  |  "
        f"Window: {state.total_vehicles_in_window} vehicles"
    )
    if state.direction_imbalance.detected:
        text += f"  |  IMBALANCE: mov {state.direction_imbalance.dominant_movement}"

    cv2.putText(frame, text, (10, y_start + 22),
                FONT, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    return frame


def create_video_writer(
    output_path: str,
    width: int,
    height: int,
    fps: float,
) -> cv2.VideoWriter:
    """Create an OpenCV VideoWriter for MP4 output."""
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError(f"Failed to open VideoWriter at: {output_path}")
    return writer
