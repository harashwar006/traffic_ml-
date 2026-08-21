"""
src/counting/roi_counter.py
----------------------------
Vehicle counter for AIC21 Track 1.

Counting rules (from dataset readme):
  1. Count vehicle when it FULLY EXITS the ROI polygon.
  2. Only Car (class 1) and Truck (class 2) are counted.
  3. Motorcycles and bicycles are NOT counted.
  4. U-turns are NOT counted.
  5. Each vehicle (track_id) is counted AT MOST ONCE.

The counter receives ExitEvents from MovementAssigner
and accumulates counts by class, movement, and time window.
"""

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from src.movement.movement_assigner import EntryEvent, ExitEvent

log = logging.getLogger(__name__)


@dataclass
class CountResult:
    """Snapshot of accumulated vehicle counts."""
    total: int = 0
    by_class: Dict[str, int] = field(default_factory=dict)
    by_movement: Dict[int, int] = field(default_factory=dict)
    by_movement_and_class: Dict[int, Dict[str, int]] = field(default_factory=dict)
    by_time_window: Dict[str, int] = field(default_factory=dict)  # "0-60s": count

    def to_dict(self) -> dict:
        return {
            "total": self.total,
            "by_class": dict(self.by_class),
            "by_movement": {str(k): v for k, v in self.by_movement.items()},
            "by_movement_and_class": {
                str(k): dict(v)
                for k, v in self.by_movement_and_class.items()
            },
            "by_time_window": dict(self.by_time_window),
        }


class VehicleCounter:
    """
    Accumulates unique vehicle counts on ROI Entry and assigns movements.

    Design:
    - Counts are unique per track_id upon ROI entry.
    - Each vehicle is counted once when entering the ROI.
    - Movements are assigned as the vehicle progresses through the intersection.
    """

    def __init__(self, time_window_seconds: float = 60.0):
        self.time_window = time_window_seconds

        # Cumulative counters
        self._total: int = 0
        self._counted_track_ids: set = set()
        self._by_class: Dict[str, int] = defaultdict(int)
        self._by_movement: Dict[int, int] = defaultdict(int)
        self._by_movement_and_class: Dict[int, Dict[str, int]] = defaultdict(
            lambda: defaultdict(int)
        )
        self._by_time_window: Dict[str, int] = defaultdict(int)
        self._entry_events: List[EntryEvent] = []
        self._exit_events: List[ExitEvent] = []

        log.info(f"VehicleCounter ready | time_window={time_window_seconds}s")

    def register_entry(self, event: EntryEvent) -> None:
        """
        Record one vehicle entry (= one unique count).
        Called immediately when a vehicle reference point enters the ROI.
        """
        if event.track_id in self._counted_track_ids:
            return

        self._counted_track_ids.add(event.track_id)
        self._total += 1
        self._by_class[event.aic21_class_name] += 1

        # Time bucket
        bucket_idx = int(event.timestamp_sec // self.time_window)
        t_start = bucket_idx * self.time_window
        t_end = t_start + self.time_window
        bucket_key = f"{t_start:.0f}-{t_end:.0f}s"
        self._by_time_window[bucket_key] += 1

        self._entry_events.append(event)
        log.debug(
            f"ENTRY COUNT: track={event.track_id} class={event.aic21_class_name} "
            f"t={event.timestamp_sec:.1f}s total={self._total}"
        )

    def register_entries(self, events: List[EntryEvent]) -> None:
        """Register a batch of entry events."""
        for event in events:
            self.register_entry(event)

    def register_exit(self, event: ExitEvent) -> None:
        """
        Record movement assignment for a vehicle.
        """
        if event.movement_id is not None:
            self._by_movement[event.movement_id] += 1
            self._by_movement_and_class[event.movement_id][event.aic21_class_name] += 1

        self._exit_events.append(event)
        log.debug(
            f"MOVEMENT ASSIGNED: track={event.track_id} movement={event.movement_id} "
            f"t={event.timestamp_sec:.1f}s"
        )

    def register_exits(self, events: List[ExitEvent]) -> None:
        """Register a batch of exit events."""
        for event in events:
            self.register_exit(event)

    def get_result(self) -> CountResult:
        """Return current cumulative count snapshot."""
        return CountResult(
            total=self._total,
            by_class=dict(self._by_class),
            by_movement=dict(self._by_movement),
            by_movement_and_class={
                k: dict(v) for k, v in self._by_movement_and_class.items()
            },
            by_time_window=dict(self._by_time_window),
        )

    def get_flow_rate(
        self,
        window_start_sec: float,
        window_end_sec: float,
        movement_id: Optional[int] = None,
    ) -> float:
        """
        Compute vehicle flow rate (vehicles/minute) in a time window.

        Args:
            window_start_sec: Start of the window (seconds from video start).
            window_end_sec:   End of the window.
            movement_id:      If set, only count vehicles from this movement.
                              If None, count all vehicles.

        Returns:
            Flow rate in vehicles/minute.
        """
        window_duration_min = (window_end_sec - window_start_sec) / 60.0
        if window_duration_min <= 0:
            return 0.0

        count = 0
        for event in self._exit_events:
            if window_start_sec <= event.timestamp_sec < window_end_sec:
                if movement_id is None or event.movement_id == movement_id:
                    count += 1

        return count / window_duration_min

    def get_all_exit_events(self) -> List[ExitEvent]:
        return list(self._exit_events)

    def get_counts_at_frame(self, max_frame_id: int) -> CountResult:
        """
        Return cumulative counts up to a specific frame_id.
        Used for evaluation against GT which is frame-indexed.
        """
        result = CountResult()
        by_class: Dict[str, int] = defaultdict(int)
        by_movement: Dict[int, int] = defaultdict(int)
        by_movement_and_class: Dict[int, Dict[str, int]] = defaultdict(
            lambda: defaultdict(int)
        )

        for event in self._exit_events:
            if event.frame_id <= max_frame_id:
                result.total += 1
                by_class[event.aic21_class_name] += 1
                if event.movement_id is not None:
                    by_movement[event.movement_id] += 1
                    by_movement_and_class[event.movement_id][event.aic21_class_name] += 1

        result.by_class = dict(by_class)
        result.by_movement = dict(by_movement)
        result.by_movement_and_class = {k: dict(v) for k, v in by_movement_and_class.items()}
        return result

    def reset(self) -> None:
        """Reset all counts (call between different videos)."""
        self._total = 0
        self._by_class.clear()
        self._by_movement.clear()
        self._by_movement_and_class.clear()
        self._by_time_window.clear()
        self._exit_events.clear()

    def summary_str(self) -> str:
        lines = [
            f"Total vehicles counted: {self._total}",
            f"  Cars:   {self._by_class.get('Car', 0)}",
            f"  Trucks: {self._by_class.get('Truck', 0)}",
            "  By movement:",
        ]
        for mov_id in sorted(self._by_movement.keys()):
            lines.append(
                f"    Movement {mov_id}: {self._by_movement[mov_id]} "
                f"(Car={self._by_movement_and_class[mov_id].get('Car', 0)}, "
                f"Truck={self._by_movement_and_class[mov_id].get('Truck', 0)})"
            )
        return "\n".join(lines)
