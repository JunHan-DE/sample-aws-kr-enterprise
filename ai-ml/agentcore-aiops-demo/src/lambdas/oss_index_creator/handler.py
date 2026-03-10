"""Custom Resource: create OpenSearch Serverless vector index using opensearch-py."""
import json
import time
import urllib.request
import boto3
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

_event = None
_context = None


def handler(event, context):
    global _event, _context
    _event, _context = event, context
    print(json.dumps(event, default=str))

    props = event.get("ResourceProperties", {})
    pid = f"oss-index-{props.get('IndexName', 'default')}"

    try:
        if event.get("RequestType") == "Create":
            endpoint = props.get("CollectionEndpoint", "")
            collection_name = props.get("CollectionName", "aiops-demo-kb")
            index_name = props.get("IndexName", "aiops-demo-index")
            if endpoint:
                _wait_for_collection(collection_name, context)
                _create_index_with_retry(endpoint, index_name, context)
                # Extra wait for KB role access policy propagation
                print("Index created. Waiting 60s for KB role policy propagation...")
                time.sleep(60)
        _send(event, context, "SUCCESS", pid)
    except Exception as e:
        print(f"Error: {e}")
        _send(event, context, "FAILED", pid, str(e))


def _wait_for_collection(name, ctx):
    client = boto3.client("opensearchserverless")
    for i in range(60):
        _check_time(ctx, f"waiting for collection (attempt {i})")
        resp = client.list_collections(collectionFilters={"name": name})
        summaries = resp.get("collectionSummaries", [])
        if summaries and summaries[0].get("status") == "ACTIVE":
            print(f"Collection ACTIVE after {i*10}s")
            return
        print(f"Collection: {summaries[0].get('status') if summaries else 'NOT_FOUND'}")
        time.sleep(10)
    raise Exception("Collection did not become ACTIVE")


def _create_index_with_retry(endpoint, index_name, ctx):
    host = endpoint.replace("https://", "")
    region = boto3.Session().region_name or "ap-northeast-2"
    creds = boto3.Session().get_credentials().get_frozen_credentials()
    auth = AWS4Auth(creds.access_key, creds.secret_key, region, "aoss", session_token=creds.token)

    client = OpenSearch(
        hosts=[{"host": host, "port": 443}],
        http_auth=auth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=30,
    )

    index_body = {
        "settings": {"index": {"knn": True}},
        "mappings": {"properties": {
            "vector": {"type": "knn_vector", "dimension": 1024, "method": {"engine": "faiss", "name": "hnsw"}},
            "text": {"type": "text"},
            "metadata": {"type": "text"},
        }},
    }

    for i in range(80):
        _check_time(ctx, f"creating index (attempt {i})")
        try:
            resp = client.indices.create(index=index_name, body=index_body)
            print(f"Index created: {resp}")
            return
        except Exception as e:
            err = str(e)
            if "resource_already_exists_exception" in err:
                print("Index already exists")
                return
            if "403" in err or "Forbidden" in err:
                print(f"403 (attempt {i}), waiting 10s...")
                time.sleep(10)
            else:
                raise Exception(f"Index creation error: {err}")
    raise Exception("Index creation failed after max retries")


def _check_time(ctx, msg):
    remaining = ctx.get_remaining_time_in_millis() // 1000
    if remaining < 30:
        raise Exception(f"Timeout ({remaining}s left) during: {msg}")


def _send(event, context, status, pid, reason=""):
    if not event or not event.get("ResponseURL"):
        return
    body = json.dumps({
        "Status": status, "Reason": reason or "OK",
        "PhysicalResourceId": pid,
        "StackId": event.get("StackId", ""),
        "RequestId": event.get("RequestId", ""),
        "LogicalResourceId": event.get("LogicalResourceId", ""),
        "Data": {},
    })
    try:
        req = urllib.request.Request(event["ResponseURL"], data=body.encode(), method="PUT",
                                     headers={"Content-Type": "", "Content-Length": str(len(body))})
        urllib.request.urlopen(req, timeout=10)
        print(f"CFN: {status}")
    except Exception as e:
        print(f"CFN send failed: {e}")
