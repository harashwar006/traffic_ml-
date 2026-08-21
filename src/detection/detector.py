"""
src/detection/detector.py
--------------------------
YOLOv8n vehicle detector for AIC21 Track 1.

COCO → AIC21 class mapping:
  COCO 2 (car)   → AIC21 1 (Car)
  COCO 5 (bus)   → AIC21 1 (Car)   [buses counted as cars per intersection rules]
  COCO 7 (truck) → AIC21 2 (Truck)
  COCO 3 (motorcycle) → DETECTED but NOT counted

No custom training is performed — no bbox annotations exist in this dataset.
The pretrained COCO model is used directly.
"""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
from ultralytics import YOLO

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# COCO ID → AIC21 class mapping
# ---------------------------------------------------------------------------
COCO_TO_AIC21: Dict[int, str] = {
    2: "Car",           # car
    5: "Car",           # bus (treated as Car for AIC21 counting)
    7: "Truck",         # truck
    3: "Motorcycle",    # motorcycle — detected but not counted
}

# AIC21 class_id for output
AIC21_CLASS_ID: Dict[str, int] = {
    "Car": 1,
    "Truck": 2,
    "Motorcycle": 0,    # not counted
}

# COCO class IDs we want to detect (vehicle classes only)
TARGET_COCO_IDS = set(COCO_TO_AIC21.keys())   # {2, 3, 5, 7}


@dataclass
class Detection:
    """Single vehicle detection on one frame."""
    frame_id: int
    timestamp_sec: float
    coco_class_id: int
    aic21_class_name: str       # "Car", "Truck", "Motorcycle"
    aic21_class_id: int         # 1=Car, 2=Truck, 0=Motorcycle
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
    def width(self) -> float:
        return self.x2 - self.x1

    @property
    def height(self) -> float:
        return self.y2 - self.y1

    @property
    def area(self) -> float:
        return self.width * self.height

    def is_countable(self) -> bool:
        """Per AIC21 rules: only Car and Truck are counted."""
        return self.aic21_class_name in ("Car", "Truck")

    def to_dict(self) -> dict:
        return {
            "frame_id": self.frame_id,
            "timestamp_sec": round(self.timestamp_sec, 3),
            "aic21_class_name": self.aic21_class_name,
            "aic21_class_id": self.aic21_class_id,
            "confidence": round(self.confidence, 4),
            "x1": round(self.x1, 1),
            "y1": round(self.y1, 1),
            "x2": round(self.x2, 1),
            "y2": round(self.y2, 1),
        }


class VehicleDetector:
    """
    YOLOv8n-based vehicle detector.
    Wraps ultralytics YOLO and applies COCO → AIC21 class mapping.
    """

    def __init__(
        self,
        model_path: Optional[str] = None,
        confidence: float = 0.35,
        iou_threshold: float = 0.45,
        input_size: int = 640,
        device: Optional[str] = None,
    ):
        """
        Args:
            model_path:   Path to .pt weights. None = download yolov8n.pt.
            confidence:   Detection confidence threshold.
            iou_threshold: NMS IoU threshold.
            input_size:   Inference image size (pixels, square).
            device:       "cuda", "cpu", or None (auto).
        """
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device
        self.confidence = confidence
        self.iou_threshold = iou_threshold
        self.input_size = input_size

        # Load model
        if model_path and Path(model_path).exists():
            log.info(f"Loading YOLOv8 from: {model_path}")
            self.model = YOLO(model_path)
        else:
            log.info("Downloading yolov8n.pt (pretrained COCO)")
            self.model = YOLO("yolov8n.pt")

        # Move to device
        self.model.to(device)
        log.info(f"Detector ready on device={device} | conf={confidence} | iou={iou_threshold}")

    def detect(
        self,
        frame: np.ndarray,
        frame_id: int = 0,
        timestamp_sec: float = 0.0,
    ) -> List[Detection]:
        """
        Run detection on a single BGR frame.

        Args:
            frame:         BGR numpy array.
            frame_id:      Original frame index in the video.
            timestamp_sec: Time in seconds from video start.

        Returns:
            List of Detection objects (only vehicle classes).
        """
        results = self.model(
            frame,
            conf=self.confidence,
            iou=self.iou_threshold,
            imgsz=self.input_size,
            verbose=False,
            classes=list(TARGET_COCO_IDS),   # only detect vehicle classes
        )

        detections = []
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
            for box in boxes:
                coco_id = int(box.cls.item())
                if coco_id not in TARGET_COCO_IDS:
                    continue
                aic21_name = COCO_TO_AIC21[coco_id]
                xyxy = box.xyxy[0].tolist()
                detections.append(Detection(
                    frame_id=frame_id,
                    timestamp_sec=timestamp_sec,
                    coco_class_id=coco_id,
                    aic21_class_name=aic21_name,
                    aic21_class_id=AIC21_CLASS_ID[aic21_name],
                    confidence=float(box.conf.item()),
                    x1=xyxy[0],
                    y1=xyxy[1],
                    x2=xyxy[2],
                    y2=xyxy[3],
                ))

        return detections

    def detect_batch(
        self,
        frames: List[np.ndarray],
        frame_ids: Optional[List[int]] = None,
        timestamps: Optional[List[float]] = None,
    ) -> List[List[Detection]]:
        """
        Run detection on a batch of frames.
        Returns a list of detection lists, one per frame.
        """
        if frame_ids is None:
            frame_ids = list(range(len(frames)))
        if timestamps is None:
            timestamps = [0.0] * len(frames)

        results = self.model(
            frames,
            conf=self.confidence,
            iou=self.iou_threshold,
            imgsz=self.input_size,
            verbose=False,
            classes=list(TARGET_COCO_IDS),
        )

        batch_detections = []
        for i, result in enumerate(results):
            frame_dets = []
            boxes = result.boxes
            if boxes is not None:
                for box in boxes:
                    coco_id = int(box.cls.item())
                    if coco_id not in TARGET_COCO_IDS:
                        continue
                    aic21_name = COCO_TO_AIC21[coco_id]
                    xyxy = box.xyxy[0].tolist()
                    frame_dets.append(Detection(
                        frame_id=frame_ids[i],
                        timestamp_sec=timestamps[i],
                        coco_class_id=coco_id,
                        aic21_class_name=aic21_name,
                        aic21_class_id=AIC21_CLASS_ID[aic21_name],
                        confidence=float(box.conf.item()),
                        x1=xyxy[0],
                        y1=xyxy[1],
                        x2=xyxy[2],
                        y2=xyxy[3],
                    ))
            batch_detections.append(frame_dets)
        return batch_detections
