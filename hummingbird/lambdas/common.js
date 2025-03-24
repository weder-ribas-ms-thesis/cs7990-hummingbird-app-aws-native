const flow = require('lodash/flow.js');
const { getLogger } = require('./logger.js');
const { publishMetric } = require('./clients/cloudwatch.js');

const logger = getLogger();

const withErrorLogging =
  (handler) =>
  async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  };

const withEventLogging =
  (handler) =>
  async (...args) =>
    await handler(...args);

const withLogging = flow(withEventLogging, withErrorLogging);

/**
 * Extracts the media ID from an S3 key.
 * An S3 key is in the format `{prefix}/{mediaId}/{mediaName}`
 * @param {string} s3Key The media S3 key
 * @returns {string} The media ID
 */
const getMediaId = (s3Key) => {
  const keyArray = s3Key.split('/');

  if (keyArray.length === 1) {
    return keyArray[0];
  }

  return keyArray[1];
};

/**
 * Publishes a metric to CloudWatch.
 * @param {string} metricName
 * @param {double} value
 * @param {scope} scope
 * @param {string} reason
 * @returns {Promise<void>}
 */
const publishGenericMetric = async ({
  metricName,
  value,
  scope,
  reason = 'unknown',
}) => {
  try {
    await publishMetric({
      payload: [
        {
          MetricName: metricName,
          Unit: 'Count',
          Value: value,
          Dimensions: [
            {
              Name: 'environment',
              Value: process.env.NODE_ENV,
            },
            {
              Name: 'reason',
              Value: reason,
            },
            {
              Name: 'scope',
              Value: scope,
            },
          ],
        },
      ],
    });
  } catch (error) {
    logger.error('Failed to publish media upload metric', error);
  }
};

module.exports = { withLogging, getMediaId, publishGenericMetric };
