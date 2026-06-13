"""Server-side Supabase Realtime broadcasts.

The app no longer needs to poll the backend every few seconds to notice that a
teammate checked in, got nudged, or changed their pledge. Instead, after any
mutation that changes group-visible state, the backend fires a lightweight
"changed" broadcast on the group's Realtime channel (`group:<id>`). Clients
subscribed to that channel react by refetching the group slice once, so updates
feel instant without exposing the database directly to the client.

We use the Realtime *broadcast* REST endpoint (not Postgres Changes) on purpose:
 - sending is authorized with the service key, so no RLS policies are required;
 - the payload carries no data, only a "something changed" ping, so a public
   channel leaks nothing meaningful even if someone subscribed to another topic.

The call is best-effort and time-boxed: a broadcast failure must never block or
fail the user's actual mutation.
"""
from __future__ import annotations

import json
import os
import urllib.request

_TIMEOUT_S = 2.5


def _credentials() -> tuple[str, str] | None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        return None
    return url.rstrip("/"), key


def _broadcast(topic: str) -> None:
    """Fire a `changed` event on `topic`. Best-effort; never raises."""
    creds = _credentials()
    if not creds:
        return
    url, key = creds
    try:
        body = json.dumps(
            {"messages": [{"topic": topic, "event": "changed", "payload": {}}]}
        ).encode("utf-8")
        req = urllib.request.Request(
            f"{url}/realtime/v1/api/broadcast",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "apikey": key,
                "Authorization": f"Bearer {key}",
            },
        )
        urllib.request.urlopen(req, timeout=_TIMEOUT_S).close()
    except Exception:
        # Best-effort: realtime is an enhancement, never a hard dependency.
        pass


def broadcast_group_changed(group_id: str | None) -> None:
    """Tell every client on `group:<group_id>` to refresh."""
    if not group_id:
        return
    _broadcast(f"group:{group_id}")


def broadcast_clock_changed() -> None:
    """The simulated dev clock is global state, so tell *every* connected client
    (channel `clock`) to re-sync, not just one group."""
    _broadcast("clock")
