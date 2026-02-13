"""
Lambda aggregator for Bedrock Claude Code usage metrics.

Runs every 1 minute via EventBridge. Reads CloudWatch metrics from AWS/Bedrock
namespace, calculates costs, and writes aggregated data to DynamoDB at minute,
hourly, daily, and cumulative monthly granularities.
"""

import json
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TABLE_NAME = os.environ.get("TABLE_NAME", "")
METRICS_REGION = "us-east-1"

MODEL_IDS = [
    "global.anthropic.claude-opus-4-6-v1",
    "global.anthropic.claude-opus-4-5-20251101-v1:0",
    "us.anthropic.claude-opus-4-5-20251101-v1:0",
    "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    "us.anthropic.claude-3-5-haiku-20241022-v1:0",
]

METRIC_NAMES = [
    ("Invocations", "Sum"),
    ("InputTokenCount", "Sum"),
    ("OutputTokenCount", "Sum"),
    ("CacheReadInputTokenCount", "Sum"),
    ("CacheWriteInputTokenCount", "Sum"),
    ("InvocationLatency", "Average"),
]

# Pricing per 1 million tokens — AWS Bedrock Global Cross-region (US East - N. Virginia)
PRICING = {
    "opus": {
        "input": Decimal("5"),
        "output": Decimal("25"),
        "cache_write": Decimal("6.25"),
        "cache_read": Decimal("0.50"),
    },
    "sonnet": {
        "input": Decimal("3"),
        "output": Decimal("15"),
        "cache_write": Decimal("3.75"),
        "cache_read": Decimal("0.30"),
    },
    "haiku": {
        "input": Decimal("1"),
        "output": Decimal("5"),
        "cache_write": Decimal("1.25"),
        "cache_read": Decimal("0.10"),
    },
}

ONE_MILLION = Decimal("1000000")
MINUTE_TTL_SECONDS = 604800       # 7 days
HOURLY_TTL_SECONDS = 7776000      # 90 days


def _get_model_tier(model_id: str) -> str:
    """Return pricing tier key for a given model ID."""
    mid = model_id.lower()
    if "opus" in mid:
        return "opus"
    if "sonnet" in mid:
        return "sonnet"
    return "haiku"


def _calculate_cost(
    input_tokens: Decimal,
    output_tokens: Decimal,
    cache_read_tokens: Decimal,
    cache_write_tokens: Decimal,
    tier: str,
) -> tuple[Decimal, Decimal]:
    """Return (cost, cache_savings) for the given token counts and pricing tier."""
    p = PRICING[tier]
    cost = (
        input_tokens * p["input"]
        + output_tokens * p["output"]
        + cache_write_tokens * p["cache_write"]
        + cache_read_tokens * p["cache_read"]
    ) / ONE_MILLION

    # Cache savings: tokens served from cache that would have cost full input price
    cache_savings = cache_read_tokens * (p["input"] - p["cache_read"]) / ONE_MILLION

    return (
        cost.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP),
        cache_savings.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP),
    )


# ---------------------------------------------------------------------------
# CloudWatch helpers
# ---------------------------------------------------------------------------

def _build_metric_queries() -> list[dict]:
    """Build GetMetricData metric queries for all models and metrics."""
    queries = []
    for model_idx, model_id in enumerate(MODEL_IDS):
        for metric_name, stat in METRIC_NAMES:
            query_id = f"m{model_idx}_{metric_name.lower()}"
            queries.append(
                {
                    "Id": query_id,
                    "MetricStat": {
                        "Metric": {
                            "Namespace": "AWS/Bedrock",
                            "MetricName": metric_name,
                            "Dimensions": [
                                {"Name": "ModelId", "Value": model_id},
                            ],
                        },
                        "Period": 60,
                        "Stat": stat,
                    },
                    "ReturnData": True,
                }
            )
    return queries


def _fetch_metrics(cw_client) -> dict:
    """
    Fetch CloudWatch metrics for the last 2 minutes.

    Returns a dict keyed by model_id, each containing metric values.
    Only models with at least one non-zero metric are included.
    """
    now = datetime.now(timezone.utc)
    start_time = now - timedelta(minutes=2)

    queries = _build_metric_queries()
    all_results = []

    # GetMetricData supports max 500 queries per call; we have 7 * 6 = 42
    try:
        paginator = cw_client.get_paginator("get_metric_data")
        for page in paginator.paginate(
            MetricDataQueries=queries,
            StartTime=start_time,
            EndTime=now,
            ScanBy="TimestampDescending",
        ):
            all_results.extend(page.get("MetricDataResults", []))
    except ClientError as e:
        logger.error("CloudWatch GetMetricData failed: %s", e)
        return {}

    # Parse results into per-model structure
    model_metrics: dict[str, dict[str, Decimal]] = {}

    for result in all_results:
        query_id = result["Id"]
        values = result.get("Values", [])
        if not values:
            continue

        # Sum all datapoints in the window (handles overlap / multiple minutes)
        # For latency (Average), we take the mean of available datapoints
        parts = query_id.split("_", 1)
        model_idx = int(parts[0][1:])  # strip leading 'm'
        metric_key = parts[1]
        model_id = MODEL_IDS[model_idx]

        if model_id not in model_metrics:
            model_metrics[model_id] = {
                "invocations": Decimal("0"),
                "inputtokencount": Decimal("0"),
                "outputtokencount": Decimal("0"),
                "cachereadinputtokencount": Decimal("0"),
                "cachewriteinputtokencount": Decimal("0"),
                "invocationlatency": Decimal("0"),
                "_latency_count": Decimal("0"),
            }

        if metric_key == "invocationlatency":
            # Average latency: accumulate sum and count for proper averaging
            for v in values:
                model_metrics[model_id]["invocationlatency"] += Decimal(str(v))
                model_metrics[model_id]["_latency_count"] += Decimal("1")
        else:
            # For Sum stats, take the most recent datapoint only to avoid
            # double-counting across the 2-minute query window.
            # The most recent value is first (ScanBy=TimestampDescending).
            model_metrics[model_id][metric_key] += Decimal(str(values[0]))

    # Compute average latency and filter out inactive models
    active_models: dict[str, dict[str, Decimal]] = {}
    for model_id, metrics in model_metrics.items():
        latency_count = metrics.pop("_latency_count")
        if latency_count > 0:
            metrics["invocationlatency"] = (
                metrics["invocationlatency"] / latency_count
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Check if any meaningful metric is non-zero
        has_activity = any(
            v > 0
            for k, v in metrics.items()
            if k != "invocationlatency"
        )
        if has_activity:
            active_models[model_id] = metrics

    return active_models


# ---------------------------------------------------------------------------
# DynamoDB writers
# ---------------------------------------------------------------------------

def _write_minute_record(table, timestamp_iso: str, model_data: dict, now_epoch: int):
    """Write a MINUTE granularity record to DynamoDB."""
    item = {
        "pk": "METRIC#minute",
        "sk": timestamp_iso,
        "ttl": now_epoch + MINUTE_TTL_SECONDS,
        "invocations": {},
        "input_tokens": {},
        "output_tokens": {},
        "cache_read_tokens": {},
        "cache_write_tokens": {},
        "cost": {},
        "cache_savings": {},
        "latency_avg": {},
    }

    for model_id, metrics in model_data.items():
        tier = _get_model_tier(model_id)
        cost, savings = _calculate_cost(
            metrics["inputtokencount"],
            metrics["outputtokencount"],
            metrics["cachereadinputtokencount"],
            metrics["cachewriteinputtokencount"],
            tier,
        )
        item["invocations"][model_id] = metrics["invocations"]
        item["input_tokens"][model_id] = metrics["inputtokencount"]
        item["output_tokens"][model_id] = metrics["outputtokencount"]
        item["cache_read_tokens"][model_id] = metrics["cachereadinputtokencount"]
        item["cache_write_tokens"][model_id] = metrics["cachewriteinputtokencount"]
        item["cost"][model_id] = cost
        item["cache_savings"][model_id] = savings
        item["latency_avg"][model_id] = metrics["invocationlatency"]

    try:
        table.put_item(Item=item)
        logger.info("Wrote MINUTE record: SK=%s, models=%d", timestamp_iso, len(model_data))
    except ClientError as e:
        logger.error("Failed to write MINUTE record: %s", e)
        raise


def _ensure_aggregate_maps(
    table, pk: str, sk: str,
    extra_sets: str = "",
    extra_names: dict | None = None,
    extra_values: dict | None = None,
):
    """Ensure the top-level map attributes exist on an aggregate record.

    DynamoDB ADD on nested paths (e.g. ``invocations.#mid``) fails with a
    ValidationException when the parent map attribute does not exist yet.
    This helper creates the item with empty maps if it doesn't exist, and
    sets any missing map attributes on an existing item.
    """
    expr_parts = [
        "invocations = if_not_exists(invocations, :em)",
        "input_tokens = if_not_exists(input_tokens, :em)",
        "output_tokens = if_not_exists(output_tokens, :em)",
        "cache_read_tokens = if_not_exists(cache_read_tokens, :em)",
        "cache_write_tokens = if_not_exists(cache_write_tokens, :em)",
        "cost = if_not_exists(cost, :em)",
        "cache_savings = if_not_exists(cache_savings, :em)",
        "latency_avg = if_not_exists(latency_avg, :em)",
    ]
    if extra_sets:
        expr_parts.append(extra_sets)

    values: dict = {":em": {}}
    if extra_values:
        values.update(extra_values)

    kwargs: dict = {
        "Key": {"pk": pk, "sk": sk},
        "UpdateExpression": "SET " + ", ".join(expr_parts),
        "ExpressionAttributeValues": values,
    }
    if extra_names:
        kwargs["ExpressionAttributeNames"] = extra_names

    table.update_item(**kwargs)


def _add_model_to_aggregate(
    table, pk: str, sk: str, model_id: str,
    metrics: dict, cost: Decimal, savings: Decimal,
    extra_sets: str = "", extra_names: dict | None = None, extra_values: dict | None = None,
):
    """ADD metric values for a single model into an aggregate record."""
    names = {"#mid": model_id}
    if extra_names:
        names.update(extra_names)

    values = {
        ":inv": metrics["invocations"],
        ":inp": metrics["inputtokencount"],
        ":out": metrics["outputtokencount"],
        ":cr": metrics["cachereadinputtokencount"],
        ":cw": metrics["cachewriteinputtokencount"],
        ":cost": cost,
        ":sav": savings,
        ":lat": metrics["invocationlatency"],
    }
    if extra_values:
        values.update(extra_values)

    update_expr = (
        "ADD invocations.#mid :inv, "
        "input_tokens.#mid :inp, "
        "output_tokens.#mid :out, "
        "cache_read_tokens.#mid :cr, "
        "cache_write_tokens.#mid :cw, "
        "cost.#mid :cost, "
        "cache_savings.#mid :sav, "
        "latency_avg.#mid :lat"
    )
    if extra_sets:
        update_expr += " " + extra_sets

    table.update_item(
        Key={"pk": pk, "sk": sk},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def _update_hourly_record(table, now_dt: datetime, model_data: dict, now_epoch: int):
    """Update HOURLY aggregation record using ADD expressions."""
    hour_truncated = now_dt.replace(minute=0, second=0, microsecond=0)
    sk = hour_truncated.strftime("%Y-%m-%dT%H:%M:%SZ")
    ttl_value = now_epoch + HOURLY_TTL_SECONDS
    pk = "METRIC#hourly"

    # Ensure parent maps exist before ADD on nested paths
    _ensure_aggregate_maps(
        table, pk, sk,
        extra_sets="#ttl = :ttl",
        extra_names={"#ttl": "ttl"},
        extra_values={":ttl": ttl_value},
    )

    for model_id, metrics in model_data.items():
        tier = _get_model_tier(model_id)
        cost, savings = _calculate_cost(
            metrics["inputtokencount"],
            metrics["outputtokencount"],
            metrics["cachereadinputtokencount"],
            metrics["cachewriteinputtokencount"],
            tier,
        )

        try:
            _add_model_to_aggregate(
                table, pk, sk, model_id, metrics, cost, savings,
                extra_sets="SET #ttl = :ttl",
                extra_names={"#ttl": "ttl"},
                extra_values={":ttl": ttl_value},
            )
        except ClientError as e:
            logger.error("Failed to update HOURLY record for model %s: %s", model_id, e)
            raise

    logger.info("Updated HOURLY record: SK=%s", sk)


def _update_daily_record(table, now_dt: datetime, model_data: dict):
    """Update DAILY aggregation record using ADD expressions."""
    sk = now_dt.strftime("%Y-%m-%d")
    pk = "METRIC#daily"

    # Ensure parent maps exist before ADD on nested paths
    _ensure_aggregate_maps(table, pk, sk)

    for model_id, metrics in model_data.items():
        tier = _get_model_tier(model_id)
        cost, savings = _calculate_cost(
            metrics["inputtokencount"],
            metrics["outputtokencount"],
            metrics["cachereadinputtokencount"],
            metrics["cachewriteinputtokencount"],
            tier,
        )

        try:
            _add_model_to_aggregate(table, pk, sk, model_id, metrics, cost, savings)
        except ClientError as e:
            logger.error("Failed to update DAILY record for model %s: %s", model_id, e)
            raise

    logger.info("Updated DAILY record: SK=%s", sk)


def _update_cumulative_record(table, now_dt: datetime, model_data: dict, timestamp_iso: str):
    """Update CUMULATIVE monthly record."""
    sk = now_dt.strftime("%Y-%m")

    # First ensure the top-level item and by_model map exist
    try:
        table.update_item(
            Key={"pk": "CUMULATIVE", "sk": sk},
            UpdateExpression=(
                "SET by_model = if_not_exists(by_model, :empty_map), "
                "last_updated = :lu"
            ),
            ExpressionAttributeValues={
                ":empty_map": {},
                ":lu": timestamp_iso,
            },
        )
    except ClientError as e:
        logger.error("Failed to init CUMULATIVE record: %s", e)
        raise

    # Pre-calculate per-model costs and totals
    total_cost = Decimal("0")
    total_tokens = Decimal("0")

    for model_id, metrics in model_data.items():
        tier = _get_model_tier(model_id)
        cost, _ = _calculate_cost(
            metrics["inputtokencount"],
            metrics["outputtokencount"],
            metrics["cachereadinputtokencount"],
            metrics["cachewriteinputtokencount"],
            tier,
        )
        model_tokens = (
            metrics["inputtokencount"]
            + metrics["outputtokencount"]
            + metrics["cachereadinputtokencount"]
            + metrics["cachewriteinputtokencount"]
        )
        total_cost += cost
        total_tokens += model_tokens

        # Ensure the nested model map exists within by_model
        try:
            table.update_item(
                Key={"pk": "CUMULATIVE", "sk": sk},
                UpdateExpression="SET by_model.#mid = if_not_exists(by_model.#mid, :init)",
                ExpressionAttributeNames={"#mid": model_id},
                ExpressionAttributeValues={
                    ":init": {"cost": Decimal("0"), "tokens": Decimal("0"), "invocations": Decimal("0")},
                },
            )
        except ClientError as e:
            logger.error("Failed to init CUMULATIVE model map for %s: %s", model_id, e)
            raise

        # ADD the deltas into the per-model map
        try:
            table.update_item(
                Key={"pk": "CUMULATIVE", "sk": sk},
                UpdateExpression=(
                    "ADD by_model.#mid.#cost :mc, "
                    "by_model.#mid.#tokens :mt, "
                    "by_model.#mid.invocations :minv"
                ),
                ExpressionAttributeNames={
                    "#mid": model_id,
                    "#cost": "cost",
                    "#tokens": "tokens",
                },
                ExpressionAttributeValues={
                    ":mc": cost,
                    ":mt": model_tokens,
                    ":minv": metrics["invocations"],
                },
            )
        except ClientError as e:
            logger.error("Failed to update CUMULATIVE model data for %s: %s", model_id, e)
            raise

    # ADD the grand totals in a single update
    try:
        table.update_item(
            Key={"pk": "CUMULATIVE", "sk": sk},
            UpdateExpression="ADD total_cost :tc, total_tokens :tt SET last_updated = :lu",
            ExpressionAttributeValues={
                ":tc": total_cost,
                ":tt": total_tokens,
                ":lu": timestamp_iso,
            },
        )
    except ClientError as e:
        logger.error("Failed to update CUMULATIVE totals: %s", e)
        raise

    logger.info("Updated CUMULATIVE record: SK=%s, total_cost_delta=%s", sk, total_cost)


# ---------------------------------------------------------------------------
# Lambda handler
# ---------------------------------------------------------------------------

def handler(event, context):
    """Main Lambda entry point. Triggered by EventBridge every 1 minute."""
    if not TABLE_NAME:
        logger.error("TABLE_NAME environment variable is not set")
        return {"statusCode": 500, "body": "TABLE_NAME not configured"}

    logger.info("Aggregator invoked. Table=%s", TABLE_NAME)

    # Create clients
    cw_client = boto3.client("cloudwatch", region_name=METRICS_REGION)
    dynamodb = boto3.resource("dynamodb")
    table = dynamodb.Table(TABLE_NAME)

    # Fetch metrics from CloudWatch
    model_data = _fetch_metrics(cw_client)

    if not model_data:
        logger.info("No active metrics found for any model. Skipping DynamoDB writes.")
        return {"statusCode": 200, "body": "No metrics to process"}

    logger.info(
        "Found metrics for %d model(s): %s",
        len(model_data),
        list(model_data.keys()),
    )

    # Timestamps
    now_dt = datetime.now(timezone.utc)
    now_epoch = int(time.time())
    timestamp_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Write all granularities
    _write_minute_record(table, timestamp_iso, model_data, now_epoch)
    _update_hourly_record(table, now_dt, model_data, now_epoch)
    _update_daily_record(table, now_dt, model_data)
    _update_cumulative_record(table, now_dt, model_data, timestamp_iso)

    # Summary for logs
    total_invocations = sum(
        m["invocations"] for m in model_data.values()
    )
    total_input = sum(m["inputtokencount"] for m in model_data.values())
    total_output = sum(m["outputtokencount"] for m in model_data.values())

    logger.info(
        "Aggregation complete. invocations=%s, input_tokens=%s, output_tokens=%s",
        total_invocations,
        total_input,
        total_output,
    )

    return {
        "statusCode": 200,
        "body": json.dumps({
            "models_processed": len(model_data),
            "timestamp": timestamp_iso,
        }),
    }
