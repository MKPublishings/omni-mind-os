from __future__ import annotations

import queue
import threading
from dataclasses import dataclass
from typing import Callable

from .contracts import GenerateRequest, GenerateResponse
from .pipeline import OmniMediaPipeline


@dataclass(slots=True)
class Job:
    request: GenerateRequest
    on_complete: Callable[[GenerateResponse], None]


class InMemoryJobQueue:
    def __init__(self) -> None:
        self._queue: queue.Queue[Job] = queue.Queue()

    def enqueue(self, job: Job) -> None:
        self._queue.put(job)

    def dequeue(self, timeout_sec: float = 1.0) -> Job | None:
        try:
            return self._queue.get(timeout=timeout_sec)
        except queue.Empty:
            return None

    def size(self) -> int:
        return int(self._queue.qsize())


class OmniMediaWorker:
    def __init__(self, pipeline: OmniMediaPipeline, queue_backend: InMemoryJobQueue) -> None:
        self.pipeline = pipeline
        self.queue_backend = queue_backend
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3)

    def is_running(self) -> bool:
        return bool(self._thread and self._thread.is_alive() and not self._stop_event.is_set())

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            job = self.queue_backend.dequeue(timeout_sec=0.5)
            if not job:
                continue

            result = self.pipeline.run(job.request)
            job.on_complete(result)
