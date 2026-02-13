import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';

const REGION = process.env.AWS_REGION || 'us-east-1';

let client: CloudWatchClient | null = null;

export function getCloudWatchClient(): CloudWatchClient {
  if (!client) {
    client = new CloudWatchClient({ region: REGION });
  }
  return client;
}
