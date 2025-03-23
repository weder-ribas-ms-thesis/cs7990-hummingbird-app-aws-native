const {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');
const AWSXRay = require('aws-xray-sdk');
const { isLocalEnv } = require('../core/utils.js');
const { MEDIA_STATUS } = require('../core/constants.js');
const { getLogger } = require('../logger.js');

const logger = getLogger();

const endpoint = isLocalEnv()
  ? 'http://dynamodb.localhost.localstack.cloud:4566'
  : undefined;

const client = AWSXRay.captureAWSv3Client(
  new DynamoDBClient({
    endpoint,
    region: process.env.AWS_REGION,
  })
);

/**
 * Stores metadata about a media object in DynamoDB.
 * @param {object} param0 Media metadata
 * @param {string} param0.mediaId The media ID
 * @param {number} param0.size The size of the media object in bytes
 * @param {string} param0.name The original filename of the media object
 * @param {string} param0.mimetype The MIME type of the media object
 * @param {number} param0.width The size to resize the uploaded image to
 * @returns {Promise<void>}
 */
const createMedia = async ({ mediaId, size, name, mimetype, width }) => {
  const TableName = process.env.MEDIA_DYNAMODB_TABLE_NAME;
  const command = new PutItemCommand({
    TableName,
    Item: {
      PK: { S: `MEDIA#${mediaId}` },
      SK: { S: 'METADATA' },
      size: { N: size.toString() },
      name: { S: name },
      mimetype: { S: mimetype },
      status: { S: MEDIA_STATUS.PENDING },
      width: { N: String(width) },
    },
  });

  try {
    await client.send(command);
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

/**
 * Gets metadata about a media object from DynamoDB.
 * @param {string} mediaId The media ID.
 * @returns {Promise<object>} The media object metadata.
 */
const getMedia = async (mediaId) => {
  const TableName = process.env.MEDIA_DYNAMODB_TABLE_NAME;
  const command = new GetItemCommand({
    TableName,
    Key: {
      PK: { S: `MEDIA#${mediaId}` },
      SK: { S: 'METADATA' },
    },
  });

  try {
    const { Item } = await client.send(command);

    if (!Item) {
      return null;
    }

    return {
      mediaId,
      size: Number(Item.size.N),
      name: Item.name.S,
      mimetype: Item.mimetype.S,
      status: Item.status.S,
    };
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

/**
 * Conditionally updates the status of a media object in DynamoDB.
 * @param {object} param0 The media object key
 * @param {string} param0.mediaId The media ID
 * @param {string} param0.newStatus The new status to set
 * @param {string} param0.expectedCurrentStatus The expected current status
 * @returns {Promise<object>}
 */
const setMediaStatusConditionally = async ({
  mediaId,
  newStatus,
  expectedCurrentStatus,
}) => {
  const TableName = process.env.MEDIA_DYNAMODB_TABLE_NAME;
  const command = new UpdateItemCommand({
    TableName,
    Key: {
      PK: { S: `MEDIA#${mediaId}` },
      SK: { S: 'METADATA' },
    },
    UpdateExpression: 'SET #status = :newStatus',
    ConditionExpression: '#status = :expectedCurrentStatus',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':newStatus': { S: newStatus },
      ':expectedCurrentStatus': { S: expectedCurrentStatus },
    },
    ReturnValues: 'ALL_NEW',
  });

  try {
    const { Attributes } = await client.send(command);

    if (!Attributes) {
      return null;
    }

    return {
      name: Attributes.name.S,
    };
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

/**
 * Updates the status of a media object in DynamoDB.
 * @param {object} param0 Function parameters
 * @param {string} param0.mediaId The media ID
 * @param {string} param0.newStatus The new status to set
 * @returns {Promise<void>}
 */
const setMediaStatus = async ({ mediaId, newStatus }) => {
  const TableName = process.env.MEDIA_DYNAMODB_TABLE_NAME;
  const command = new UpdateItemCommand({
    TableName,
    Key: {
      PK: { S: `MEDIA#${mediaId}` },
      SK: { S: 'METADATA' },
    },
    UpdateExpression: 'SET #status = :newStatus',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':newStatus': { S: newStatus } },
  });

  try {
    await client.send(command);
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

/**
 * Deletes the media object metadata from DynamoDB.
 * @param {string} mediaId The media ID
 * @returns {Promise<object>}
 */
const deleteMedia = async (mediaId) => {
  const TableName = process.env.MEDIA_DYNAMODB_TABLE_NAME;
  const command = new DeleteItemCommand({
    TableName,
    Key: {
      PK: { S: `MEDIA#${mediaId}` },
      SK: { S: 'METADATA' },
    },
    ReturnValues: 'ALL_OLD',
  });

  try {
    const { Attributes } = await client.send(command);

    if (!Attributes) {
      return null;
    }

    return {
      name: Attributes.name.S,
      status: Attributes.status.S,
    };
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

module.exports = {
  createMedia,
  getMedia,
  setMediaStatusConditionally,
  setMediaStatus,
  deleteMedia,
};
