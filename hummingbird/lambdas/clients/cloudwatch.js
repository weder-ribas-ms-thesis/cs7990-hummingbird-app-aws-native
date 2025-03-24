const {
  CloudWatchClient,
  PutMetricDataCommand,
  MetricDatum,
} = require('@aws-sdk/client-cloudwatch');
const AWSXRay = require('aws-xray-sdk');
const { getLogger } = require('../logger.js');

const logger = getLogger();

const client = AWSXRay.captureAWSv3Client(
  new CloudWatchClient({
    region: process.env.AWS_REGION,
  })
);

const NAMESPACE = 'hummingbird/lambdas';

/**
 * Publishes a custom metric to AWS CloudWatch.
 * @param {object} param The function parameters
 * @param {param0.MetricDatum[]} payload
 * @returns {Promise<void>}
 */
const publishMetric = async ({ payload }) => {
  const command = new PutMetricDataCommand({
    MetricData: payload,
    Namespace: NAMESPACE,
  });

  try {
    await client.send(command);
  } catch (error) {
    logger.error(error);
    throw error;
  }
};

module.exports = { publishMetric };
