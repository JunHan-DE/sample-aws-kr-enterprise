"""
Backfill script for historical CloudWatch Bedrock usage metrics into DynamoDB.

Queries CloudWatch from 2026-02-04T00:00:00Z to now for all 7 models,
using hourly granularity (Period=3600). Writes METRIC#hourly, METRIC#daily,
and CUMULATIVE records to DynamoDB in the exact same format as the Lambda
aggregator (index.py).
"""
from __future__ import annotations

import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

import boto3
import boto3.dynamodb.conditions
from botocore.exceptions import ClientError

# ---------------------------------------------------------------------------
# Configuration (matches index.py exactly)
# ---------------------------------------------------------------------------

TABLE_NAME = "BedrockUsageMetrics"
METRICS_REGION = "us-east-1"

MODEL_IDS = [
    "global.anthropic.claude-opus-4-6-v1",
    "global.anthropic.claude-opus-4-5-20251101-v1:0",
    "us.anthropic.claude-opus-4-5-20251101-v1:0",
    "global.anthropic.claude-sonnet-4-6",
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
HOURLY_TTL_SECONDS = 7776000  # 90 days

BACKFILL_START = datetime(2026, 2, 4, 0, 0, 0, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Helpers (same logic as index.py)
# ---------------------------------------------------------------------------

def _get_model_tier(model_id: str) -> str:
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
    p = PRICING[tier]
    cost = (
        input_tokens * p["input"]
        + output_tokens * p["output"]
        + cache_write_tokens * p["cache_write"]
        + cache_read_tokens * p["cache_read"]
    ) / ONE_MILLION

    cache_savings = cache_read_tokens * (p["input"] - p["cache_read"]) / ONE_MILLION

    return (
        cost.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP),
        cache_savings.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP),
    )


# ---------------------------------------------------------------------------
# CloudWatch fetch (hourly granularity, with pagination)
# ---------------------------------------------------------------------------

def _fetch_hourly_metrics(cw_client, start_time: datetime, end_time: datetime) -> dict:
    """
    Fetch hourly CloudWatch metrics for all models between start_time and end_time.

    Returns: dict keyed by hour ISO string -> model_id -> metric dict
    e.g. {"2026-02-05T03:00:00Z": {"global.anthropic.claude-opus-4-6-v1": {...}}}
    """
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
                        "Period": 3600,
                        "Stat": stat,
                    },
                    "ReturnData": True,
                }
            )

    all_results = []
    try:
        paginator = cw_client.get_paginator("get_metric_data")
        for page in paginator.paginate(
            MetricDataQueries=queries,
            StartTime=start_time,
            EndTime=end_time,
            ScanBy="TimestampAscending",
            MaxDatapoints=100800,
        ):
            all_results.extend(page.get("MetricDataResults", []))
    except ClientError as e:
        print(f"  ERROR: CloudWatch GetMetricData failed: {e}")
        return {}

    # Parse results into per-hour, per-model structure
    # hour_str -> model_id -> { metric_key: Decimal }
    hourly_data: dict[str, dict[str, dict[str, Decimal]]] = {}

    for result in all_results:
        query_id = result["Id"]
        timestamps = result.get("Timestamps", [])
        values = result.get("Values", [])

        parts = query_id.split("_", 1)
        model_idx = int(parts[0][1:])
        metric_key = parts[1]
        model_id = MODEL_IDS[model_idx]

        for ts, val in zip(timestamps, values):
            hour_str = ts.strftime("%Y-%m-%dT%H:%M:%SZ")

            if hour_str not in hourly_data:
                hourly_data[hour_str] = {}

            if model_id not in hourly_data[hour_str]:
                hourly_data[hour_str][model_id] = {
                    "invocations": Decimal("0"),
                    "inputtokencount": Decimal("0"),
                    "outputtokencount": Decimal("0"),
                    "cachereadinputtokencount": Decimal("0"),
                    "cachewriteinputtokencount": Decimal("0"),
                    "invocationlatency": Decimal("0"),
                }

            hourly_data[hour_str][model_id][metric_key] = Decimal(str(val))

    return hourly_data


# ---------------------------------------------------------------------------
# DynamoDB writers (same structure as index.py)
# ---------------------------------------------------------------------------

def _ensure_aggregate_maps(
    table, pk: str, sk: str,
    extra_sets: str = "",
    extra_names: dict | None = None,
    extra_values: dict | None = None,
):
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


def _write_hourly_record(table, hour_str: str, model_data: dict, now_epoch: int):
    pk = "METRIC#hourly"
    sk = hour_str
    ttl_value = now_epoch + HOURLY_TTL_SECONDS

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
        _add_model_to_aggregate(
            table, pk, sk, model_id, metrics, cost, savings,
            extra_sets="SET #ttl = :ttl",
            extra_names={"#ttl": "ttl"},
            extra_values={":ttl": ttl_value},
        )


def _write_daily_record(table, date_str: str, model_data: dict):
    pk = "METRIC#daily"
    sk = date_str

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
        _add_model_to_aggregate(table, pk, sk, model_id, metrics, cost, savings)


def _write_cumulative_record(table, month_str: str, model_data: dict, timestamp_iso: str):
    # Ensure the base item exists with by_model map
    table.update_item(
        Key={"pk": "CUMULATIVE", "sk": month_str},
        UpdateExpression=(
            "SET by_model = if_not_exists(by_model, :empty_map), "
            "last_updated = :lu"
        ),
        ExpressionAttributeValues={
            ":empty_map": {},
            ":lu": timestamp_iso,
        },
    )

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
        table.update_item(
            Key={"pk": "CUMULATIVE", "sk": month_str},
            UpdateExpression="SET by_model.#mid = if_not_exists(by_model.#mid, :init)",
            ExpressionAttributeNames={"#mid": model_id},
            ExpressionAttributeValues={
                ":init": {"cost": Decimal("0"), "tokens": Decimal("0"), "invocations": Decimal("0")},
            },
        )

        # ADD the deltas into the per-model map
        table.update_item(
            Key={"pk": "CUMULATIVE", "sk": month_str},
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

    # ADD grand totals
    table.update_item(
        Key={"pk": "CUMULATIVE", "sk": month_str},
        UpdateExpression="ADD total_cost :tc, total_tokens :tt SET last_updated = :lu",
        ExpressionAttributeValues={
            ":tc": total_cost,
            ":tt": total_tokens,
            ":lu": timestamp_iso,
        },
    )


# ---------------------------------------------------------------------------
# Main backfill logic
# ---------------------------------------------------------------------------

def _purge_existing_records(table):
    """Delete all METRIC#hourly, METRIC#daily, and CUMULATIVE records to allow clean re-backfill."""
    prefixes = ["METRIC#hourly", "METRIC#daily", "CUMULATIVE"]
    total_deleted = 0

    for pk_val in prefixes:
        print(f"  Purging pk={pk_val} ...")
        count = 0
        last_key = None
        while True:
            kwargs = {
                "KeyConditionExpression": boto3.dynamodb.conditions.Key("pk").eq(pk_val),
                "ProjectionExpression": "pk, sk",
            }
            if last_key:
                kwargs["ExclusiveStartKey"] = last_key

            resp = table.query(**kwargs)
            items = resp.get("Items", [])
            for item in items:
                table.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})
                count += 1

            last_key = resp.get("LastEvaluatedKey")
            if not last_key:
                break

        print(f"    Deleted {count} record(s)")
        total_deleted += count

    return total_deleted


def main():
    now = datetime.now(timezone.utc)
    now_epoch = int(time.time())

    print("=" * 70)
    print("Bedrock Usage Metrics Backfill (with purge)")
    print("=" * 70)
    print(f"  Start:  {BACKFILL_START.isoformat()}")
    print(f"  End:    {now.isoformat()}")
    print(f"  Table:  {TABLE_NAME}")
    print(f"  Region: {METRICS_REGION}")
    print(f"  Models: {len(MODEL_IDS)}")
    print("=" * 70)

    cw_client = boto3.client("cloudwatch", region_name=METRICS_REGION)
    dynamodb = boto3.resource("dynamodb", region_name=METRICS_REGION)
    table = dynamodb.Table(TABLE_NAME)

    # Purge existing metric/cumulative records before re-backfill
    print("\n[0/3] Purging existing metric records...")
    deleted = _purge_existing_records(table)
    print(f"  Total purged: {deleted} record(s)")

    # Fetch all hourly data from CloudWatch
    print("\n[1/3] Fetching hourly metrics from CloudWatch...")
    hourly_data = _fetch_hourly_metrics(cw_client, BACKFILL_START, now)

    if not hourly_data:
        print("  No data found in CloudWatch. Nothing to backfill.")
        return

    hours_sorted = sorted(hourly_data.keys())
    print(f"  Found data for {len(hours_sorted)} hour(s)")
    print(f"  Range: {hours_sorted[0]} to {hours_sorted[-1]}")

    # Count total models with data
    total_model_hours = sum(len(models) for models in hourly_data.values())
    print(f"  Total model-hour datapoints: {total_model_hours}")

    # Aggregate into daily and monthly buckets
    # daily: date_str -> model_id -> aggregated metrics
    daily_data: dict[str, dict[str, dict[str, Decimal]]] = {}
    # monthly: month_str -> model_id -> aggregated metrics
    monthly_data: dict[str, dict[str, dict[str, Decimal]]] = {}

    for hour_str, models in hourly_data.items():
        # Parse hour_str to get date and month
        hour_dt = datetime.strptime(hour_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        date_str = hour_dt.strftime("%Y-%m-%d")
        month_str = hour_dt.strftime("%Y-%m")

        for model_id, metrics in models.items():
            # Daily aggregation
            if date_str not in daily_data:
                daily_data[date_str] = {}
            if model_id not in daily_data[date_str]:
                daily_data[date_str][model_id] = {
                    "invocations": Decimal("0"),
                    "inputtokencount": Decimal("0"),
                    "outputtokencount": Decimal("0"),
                    "cachereadinputtokencount": Decimal("0"),
                    "cachewriteinputtokencount": Decimal("0"),
                    "invocationlatency": Decimal("0"),
                }
            for key in ["invocations", "inputtokencount", "outputtokencount",
                        "cachereadinputtokencount", "cachewriteinputtokencount",
                        "invocationlatency"]:
                daily_data[date_str][model_id][key] += metrics.get(key, Decimal("0"))

            # Monthly aggregation
            if month_str not in monthly_data:
                monthly_data[month_str] = {}
            if model_id not in monthly_data[month_str]:
                monthly_data[month_str][model_id] = {
                    "invocations": Decimal("0"),
                    "inputtokencount": Decimal("0"),
                    "outputtokencount": Decimal("0"),
                    "cachereadinputtokencount": Decimal("0"),
                    "cachewriteinputtokencount": Decimal("0"),
                    "invocationlatency": Decimal("0"),
                }
            for key in ["invocations", "inputtokencount", "outputtokencount",
                        "cachereadinputtokencount", "cachewriteinputtokencount",
                        "invocationlatency"]:
                monthly_data[month_str][model_id][key] += metrics.get(key, Decimal("0"))

    # Write hourly records
    print(f"\n[2/3] Writing {len(hours_sorted)} METRIC#hourly records to DynamoDB...")
    for i, hour_str in enumerate(hours_sorted):
        models = hourly_data[hour_str]
        _write_hourly_record(table, hour_str, models, now_epoch)
        if (i + 1) % 24 == 0 or (i + 1) == len(hours_sorted):
            print(f"  Hourly: {i + 1}/{len(hours_sorted)} written ({hour_str})")

    # Write daily records
    days_sorted = sorted(daily_data.keys())
    print(f"\n[3/3] Writing {len(days_sorted)} METRIC#daily + CUMULATIVE records to DynamoDB...")
    for i, date_str in enumerate(days_sorted):
        models = daily_data[date_str]
        _write_daily_record(table, date_str, models)
        print(f"  Daily: {date_str} - {len(models)} model(s)")

    # Write cumulative records
    months_sorted = sorted(monthly_data.keys())
    for month_str in months_sorted:
        models = monthly_data[month_str]
        timestamp_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")
        _write_cumulative_record(table, month_str, models, timestamp_iso)
        print(f"  Cumulative: {month_str} - {len(models)} model(s)")

    # Summary
    print("\n" + "=" * 70)
    print("Backfill complete!")
    print(f"  Hourly records:     {len(hours_sorted)}")
    print(f"  Daily records:      {len(days_sorted)}")
    print(f"  Cumulative records: {len(months_sorted)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
