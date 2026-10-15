import { Client } from '@elastic/elasticsearch';
import { config } from './config.js';

let esClient: Client | null = null;

export function getElasticClient(): Client {
  if (!esClient) {
    const auth =
      config.ELASTICSEARCH_USERNAME && config.ELASTICSEARCH_PASSWORD
        ? {
            username: config.ELASTICSEARCH_USERNAME,
            password: config.ELASTICSEARCH_PASSWORD,
          }
        : undefined;

    esClient = new Client({
      node: config.ELASTICSEARCH_NODE,
      auth,
      maxRetries: 3,
      requestTimeout: 10000,
    });
  }
  return esClient;
}

export async function pingElasticsearch(): Promise<boolean> {
  try {
    const client = getElasticClient();
    const info = await client.ping();
    return Boolean(info);
  } catch (err: any) {
    console.warn('[Elasticsearch] Ping failed:', err.message);
    return false;
  }
}

export async function closeElasticClient(): Promise<void> {
  if (esClient) {
    await esClient.close();
    esClient = null;
  }
}
