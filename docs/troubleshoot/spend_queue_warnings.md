# Spend Update Queue Full Warnings

## Overview

The "Spend update queue is full" warning occurs in high-volume LiteLLM proxy deployments when the internal spend tracking queue reaches capacity. This is a protective mechanism to prevent memory issues during traffic spikes.

## Warning Message

```
LiteLLM Proxy:WARNING: spend_update_queue.py - Spend update queue is full. Aggregating all entries in queue to concatenate entries.
```

## Root Cause

The spend update queue is an in-memory `asyncio.Queue` capped at `LITELLM_ASYNCIO_QUEUE_MAXSIZE` entries (default `1000`). Aggregation is triggered earlier, once the queue holds `MAX_SIZE_IN_MEMORY_QUEUE` entries, which defaults to 80% of `LITELLM_ASYNCIO_QUEUE_MAXSIZE` (`800` with the defaults). When this threshold is reached:

1. New spend tracking entries are aggregated instead of queued individually
2. This prevents memory exhaustion but may slightly delay spend updates
3. The warning indicates your deployment is processing requests faster than the database can handle spend updates

## Solutions

### 1. Increase Queue Size

Raise `LITELLM_ASYNCIO_QUEUE_MAXSIZE`, which sets the actual queue capacity. `MAX_SIZE_IN_MEMORY_QUEUE` follows it at 80% unless you set it explicitly, in which case keep it below `LITELLM_ASYNCIO_QUEUE_MAXSIZE`:

```bash
LITELLM_ASYNCIO_QUEUE_MAXSIZE=62500
MAX_SIZE_IN_MEMORY_QUEUE=50000  # optional, defaults to 80% of LITELLM_ASYNCIO_QUEUE_MAXSIZE
```

Raising only `MAX_SIZE_IN_MEMORY_QUEUE` does not enlarge the queue. If it is greater than or equal to `LITELLM_ASYNCIO_QUEUE_MAXSIZE`, the proxy logs `Misconfigured queue thresholds` at startup, aggregation never runs, and spend updates block once the queue holds `LITELLM_ASYNCIO_QUEUE_MAXSIZE` entries

`LITELLM_ASYNCIO_QUEUE_MAXSIZE` also bounds the other spend update queues (daily and window spend) and the GCS bucket logging queue, so raising it raises their capacity too

**Tradeoffs:**
Higher queue sizes store more items in memory - provision at least 8GB RAM for large queues
- Recommended for deployments with consistent high traffic

### 2. Horizontal Scaling

Deploy multiple proxy instances with load balancing. This distributes the spend tracking load across multiple queues, reducing the pressure on any single instance's spend update queue.



## Related Configuration

```yaml
# Environment variables
LITELLM_ASYNCIO_QUEUE_MAXSIZE: 1000  # Default queue capacity
MAX_SIZE_IN_MEMORY_QUEUE: 800        # Default aggregation threshold (80% of LITELLM_ASYNCIO_QUEUE_MAXSIZE)
```
