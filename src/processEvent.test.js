'use strict';

jest.mock('@aws-sdk/client-s3', () => {
  const mockBody = {
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from('line one\nline two\nline three');
    },
  };

  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({ Body: mockBody }),
    })),
    GetObjectCommand: jest.fn(),
  };
});

const mockPutSend = jest.fn().mockResolvedValue({});

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn(() => ({ send: mockPutSend })),
  },
  PutCommand: jest.fn((input) => input),
}));

const { handler } = require('./processEvent');
const sampleEvent = require('../events/s3-put-event.json');

describe('Cloud Event processing handler', () => {
  beforeEach(() => {
    mockPutSend.mockClear();
  });

  test('processes an S3 event and writes a SUCCESS record to DynamoDB', async () => {
    const result = await handler(sampleEvent);

    expect(result.processed).toBe(1);
    expect(result.results[0].status).toBe('SUCCESS');
    expect(mockPutSend).toHaveBeenCalledTimes(1);

    const writtenItem = mockPutSend.mock.calls[0][0].Item;

    expect(writtenItem.status).toBe('SUCCESS');
    expect(writtenItem.lineCount).toBe(3);
    expect(writtenItem.checksum).toEqual(expect.any(String));
  });

  test('includes bucket and key in the DynamoDB record id', async () => {
    await handler(sampleEvent);

    const writtenItem = mockPutSend.mock.calls[0][0].Item;

    expect(writtenItem.id).toBe(
      'cloud-event-uploads-123456789012/sample-input.txt'
    );
  });
});
