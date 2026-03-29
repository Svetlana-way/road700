from __future__ import annotations

import math
from collections import defaultdict, deque
from collections.abc import Iterable
from dataclasses import dataclass
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status


@dataclass(frozen=True)
class RateLimitRule:
    scope: str
    key_type: str
    max_requests: int
    window_seconds: int


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str, *, max_requests: int, window_seconds: int) -> int | None:
        now = monotonic()
        threshold = now - window_seconds

        with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] <= threshold:
                bucket.popleft()

            if len(bucket) >= max_requests:
                retry_after_seconds = max(1, math.ceil(window_seconds - (now - bucket[0])))
                return retry_after_seconds

            bucket.append(now)
            return None

    def clear(self, key: str) -> None:
        with self._lock:
            self._buckets.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()


rate_limiter = InMemoryRateLimiter()


def _normalize_identifier(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    return normalized or "-"


def get_rate_limit_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
        if client_ip:
            return client_ip

    client = request.client
    if client and client.host:
        return client.host
    return "unknown"


def build_rate_limit_keys(request: Request, *, scope: str, identifier: str | None = None) -> tuple[str, str | None]:
    client_ip = get_rate_limit_client_ip(request)
    identifier_key = _normalize_identifier(identifier)
    ip_key = f"{scope}:ip:{client_ip}"
    if identifier is None:
        return ip_key, None
    return ip_key, f"{scope}:identifier:{identifier_key}"


def enforce_rate_limit(
    request: Request,
    *,
    rules: Iterable[RateLimitRule],
    identifier: str | None,
    detail: str,
) -> None:
    for rule in rules:
        ip_key, identifier_key = build_rate_limit_keys(request, scope=rule.scope, identifier=identifier)

        target_key = ip_key if rule.key_type == "ip" else identifier_key
        if target_key is None:
            continue

        retry_after = rate_limiter.hit(
            target_key,
            max_requests=rule.max_requests,
            window_seconds=rule.window_seconds,
        )
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail,
                headers={"Retry-After": str(retry_after)},
            )


def clear_rate_limit_scope(request: Request, *, scope: str, identifier: str | None) -> None:
    _, identifier_key = build_rate_limit_keys(request, scope=scope, identifier=identifier)
    if identifier_key is not None:
        rate_limiter.clear(identifier_key)
