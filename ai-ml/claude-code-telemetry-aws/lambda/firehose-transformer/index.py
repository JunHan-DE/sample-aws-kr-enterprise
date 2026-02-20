"""
Firehose Transformation Lambda for CloudWatch Logs → Parquet Pipeline.

CloudWatch Logs Subscription Filter sends data to Firehose in a specific format:
  Base64(gzip({ messageType, logGroup, logStream, logEvents: [{ id, timestamp, message }] }))

This Lambda:
  1. Decodes the CW Logs envelope (base64 → gzip decompress → JSON parse)
  2. Extracts each logEvent's message field
  3. Parses the OTLP log record JSON (from ADOT awscloudwatchlogs exporter)
  4. Flattens attributes into top-level fields matching the Glue schema
  5. Returns flat JSON records for Firehose Parquet conversion
"""

import base64
import gzip
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def handler(event, context):
    output = []

    for record in event['records']:
        record_id = record['recordId']

        try:
            # Step 1: Decode base64
            compressed = base64.b64decode(record['data'])

            # Step 2: Decompress gzip
            decompressed = gzip.decompress(compressed)

            # Step 3: Parse CW Logs envelope
            envelope = json.loads(decompressed)

            # Skip CONTROL_MESSAGE records (CW Logs health checks)
            if envelope.get('messageType') == 'CONTROL_MESSAGE':
                output.append({
                    'recordId': record_id,
                    'result': 'Dropped',
                    'data': record['data'],
                })
                continue

            log_events = envelope.get('logEvents', [])
            if not log_events:
                output.append({
                    'recordId': record_id,
                    'result': 'Dropped',
                    'data': record['data'],
                })
                continue

            # Step 4: Extract and flatten each log event
            flat_records = []
            for log_event in log_events:
                message = log_event.get('message', '')
                cw_timestamp = log_event.get('timestamp')
                flat = parse_otlp_log(message, cw_timestamp)
                if flat:
                    flat_records.append(flat)

            if not flat_records:
                output.append({
                    'recordId': record_id,
                    'result': 'Dropped',
                    'data': record['data'],
                })
                continue

            # Step 5: Encode each flat record as a JSON line (newline-delimited)
            joined = '\n'.join(json.dumps(r, default=str) for r in flat_records) + '\n'
            encoded = base64.b64encode(joined.encode('utf-8')).decode('utf-8')

            output.append({
                'recordId': record_id,
                'result': 'Ok',
                'data': encoded,
            })

        except Exception as e:
            logger.error('Failed to process record %s: %s', record_id, e, exc_info=True)
            # On error, mark as ProcessingFailed — Firehose sends to error prefix
            output.append({
                'recordId': record_id,
                'result': 'ProcessingFailed',
                'data': record['data'],
            })

    return {'records': output}


def parse_otlp_log(message: str, cw_timestamp: int | None = None) -> dict | None:
    """Parse an OTLP log record from ADOT awscloudwatchlogs exporter.

    ADOT's awscloudwatchlogs exporter writes log records in OTLP JSON format.
    The message may be:
    - A JSON object with Body, Attributes, Resource, etc. (OTLP format)
    - A plain JSON object if the log body is structured
    - A plain string

    The `resource` field from ADOT can be either:
    - A flat map: {"service.name": "claude-code", "os.type": "darwin"}
    - A nested structure: {"attributes": {"service.name": "claude-code"}}

    Args:
        message: The log message string (JSON expected)
        cw_timestamp: CloudWatch Logs event timestamp (epoch ms) as fallback
    """
    if not message or not message.strip():
        return None

    try:
        data = json.loads(message)
    except json.JSONDecodeError:
        # Not JSON — skip non-structured logs
        return None

    # ADOT awscloudwatchlogs exporter writes OTLP log records.
    # The format includes Body (the log content) and Attributes.
    # Try to extract from OTLP structure first, then fall back to flat JSON.

    flat = {}

    # Extract from OTLP log record structure
    body = data.get('Body') or data.get('body') or data
    attributes = data.get('Attributes') or data.get('attributes') or {}

    # ADOT body is the canonical event name string (e.g., "claude_code.api_request")
    # while attributes.event.name has only the short name (e.g., "api_request").
    # Capture the full body string before it gets overwritten by JSON parsing.
    body_event_name = body if isinstance(body, str) and body.startswith('claude_code.') else None

    # ADOT awscloudwatchlogs exporter outputs resource as a flat map
    # e.g., {"service.name": "claude-code", "os.type": "darwin"}
    # But it may also be nested: {"attributes": {"service.name": "..."}}
    raw_resource = data.get('Resource') or data.get('resource') or {}
    if isinstance(raw_resource, dict):
        # Check if nested structure (has 'attributes' key with dict value)
        nested = raw_resource.get('Attributes') or raw_resource.get('attributes')
        if isinstance(nested, dict):
            resource_attrs = nested
        else:
            # Flat map — use directly (ADOT's default output format)
            resource_attrs = raw_resource
    else:
        resource_attrs = {}

    # If body is a string (e.g., JSON-encoded), try to parse it
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except (json.JSONDecodeError, TypeError):
            pass

    # Merge all attribute sources for field extraction
    # Order: resource (lowest priority) → attributes → body (highest priority)
    all_attrs = {}
    if isinstance(resource_attrs, dict):
        all_attrs.update(resource_attrs)
    if isinstance(attributes, dict):
        all_attrs.update(attributes)
    if isinstance(body, dict):
        all_attrs.update(body)

    # Map to Glue schema columns
    # Use the canonical body event name (claude_code.*) if available,
    # otherwise fall back to attributes lookup
    flat['event_name'] = body_event_name or _get_str(all_attrs, 'event_name', 'event.name', 'name')
    flat['session_id'] = _get_str(all_attrs, 'session_id', 'session.id')
    # Use OTLP timestamp first, fall back to CW Logs event timestamp (epoch ms)
    flat['timestamp'] = _get_val(all_attrs, 'timestamp', 'Timestamp') or cw_timestamp
    flat['organization_id'] = _get_str(all_attrs, 'organization_id', 'organization.id')
    flat['user_id'] = _get_str(all_attrs, 'user.id', 'user_id', 'user.account.uuid', 'user_account_uuid')
    flat['user_name'] = _get_str(all_attrs, 'user.name', 'user_name')
    flat['terminal_type'] = _get_str(all_attrs, 'terminal_type', 'terminal.type')

    # Resource attributes
    flat['service_name'] = _get_str(all_attrs, 'service.name', 'service_name')
    flat['service_version'] = _get_str(all_attrs, 'service.version', 'service_version')
    flat['os_type'] = _get_str(all_attrs, 'os.type', 'os_type')
    flat['os_version'] = _get_str(all_attrs, 'os.version', 'os_version')
    flat['host_arch'] = _get_str(all_attrs, 'host.arch', 'host_arch')

    # Custom resource attributes
    flat['department'] = _get_str(all_attrs, 'department')
    flat['team_id'] = _get_str(all_attrs, 'team_id', 'team.id')
    flat['cost_center'] = _get_str(all_attrs, 'cost_center', 'cost.center')

    # Event-specific fields
    flat['prompt_length'] = _get_int(all_attrs, 'prompt_length', 'prompt.length')
    flat['prompt_id'] = _get_str(all_attrs, 'prompt.id', 'prompt_id')
    flat['tool_name'] = _get_str(all_attrs, 'tool_name', 'tool.name')
    flat['success'] = _get_bool(all_attrs, 'success')
    flat['duration_ms'] = _get_float(all_attrs, 'duration_ms', 'duration.ms')
    flat['error'] = _get_str(all_attrs, 'error', 'error.message')
    flat['decision'] = _get_str(all_attrs, 'decision')
    flat['source'] = _get_str(all_attrs, 'source', 'decision_source')
    flat['tool_parameters'] = _get_str(all_attrs, 'tool_parameters', 'tool.parameters')
    flat['tool_result_size_bytes'] = _get_int(all_attrs, 'tool_result_size_bytes')
    flat['model'] = _get_str(all_attrs, 'model', 'model.name')
    flat['speed'] = _get_str(all_attrs, 'speed')
    flat['cost_usd'] = _get_float(all_attrs, 'cost_usd', 'cost.usd')
    flat['input_tokens'] = _get_int(all_attrs, 'input_tokens', 'input.tokens')
    flat['output_tokens'] = _get_int(all_attrs, 'output_tokens', 'output.tokens')
    flat['cache_read_tokens'] = _get_int(all_attrs, 'cache_read_tokens', 'cache.read.tokens')
    flat['cache_creation_tokens'] = _get_int(all_attrs, 'cache_creation_tokens', 'cache.creation.tokens')
    flat['status_code'] = _get_int(all_attrs, 'status_code', 'http.status_code')
    flat['attempt'] = _get_int(all_attrs, 'attempt')

    # Only return records that have at minimum an event_name
    if not flat.get('event_name'):
        return None

    return flat


def _get_str(attrs: dict, *keys: str) -> str | None:
    for k in keys:
        v = attrs.get(k)
        if v is not None:
            return str(v)
    return None


def _get_int(attrs: dict, *keys: str) -> int | None:
    for k in keys:
        v = attrs.get(k)
        if v is not None:
            try:
                return int(v)
            except (ValueError, TypeError):
                pass
    return None


def _get_float(attrs: dict, *keys: str) -> float | None:
    for k in keys:
        v = attrs.get(k)
        if v is not None:
            try:
                return float(v)
            except (ValueError, TypeError):
                pass
    return None


def _get_bool(attrs: dict, *keys: str) -> bool | None:
    for k in keys:
        v = attrs.get(k)
        if v is not None:
            if isinstance(v, bool):
                return v
            if isinstance(v, str):
                return v.lower() in ('true', '1', 'yes')
            return bool(v)
    return None


def _get_val(attrs: dict, *keys: str):
    for k in keys:
        v = attrs.get(k)
        if v is not None:
            return v
    return None
