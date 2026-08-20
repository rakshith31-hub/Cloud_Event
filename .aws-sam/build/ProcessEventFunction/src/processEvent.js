'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const s3 = new S3Client({});

const TABLE_NAME = process.env.TABLE_NAME || 'CloudEventResults';

async function readObjectBody(bucket, key) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3.send(command);
  const chunks = [];

  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf-8');
}

function analyzeContent(content) {
  return {
    sizeBytes: Buffer.byteLength(content, 'utf-8'),
    lineCount: content.split('\n').length,
    checksum: crypto.createHash('sha256').update(content).digest('hex'),
  };
}

exports.handler = async (event) => {
  const results = [];

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing s3://${bucket}/${key}`);

    try {
      const content = await readObjectBody(bucket, key);
      const metrics = analyzeContent(content);

      const item = {
        id: `${bucket}/${key}`,
        bucket,
        key,
        processedAt: new Date().toISOString(),
        ...metrics,
        status: 'SUCCESS',
      };

      await ddb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
        })
      );

      results.push({ key, status: 'SUCCESS' });
    } catch (err) {
      console.error(`Failed to process ${key}:`, err);

      await ddb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            id: `${bucket}/${key}`,
            bucket,
            key,
            processedAt: new Date().toISOString(),
            status: 'FAILED',
            error: err.message,
          },
        })
      ).catch((ddbErr) =>
        console.error('Also failed to log failure record:', ddbErr)
      );

      throw err;
    }
  }

  return { processed: results.length, results };
};
