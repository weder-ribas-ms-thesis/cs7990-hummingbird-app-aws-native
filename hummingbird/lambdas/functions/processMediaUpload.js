const sharp = require('sharp');
const { ConditionalCheckFailedException } = require('@aws-sdk/client-dynamodb');
const {
  getMediaId,
  withLogging,
  publishGenericMetric,
} = require('../common.js');
const {
  setMediaStatus,
  setMediaStatusConditionally,
} = require('../clients/dynamodb.js');
const { getMediaFile, uploadMediaToStorage } = require('../clients/s3.js');
const { MEDIA_STATUS } = require('../constants.js');
const { init: initializeLogger, getLogger } = require('../logger.js');
const { publishMetric } = require('../clients/cloudwatch.js');
const { METRICS } = require('../constants.js');

initializeLogger({ service: 'processMediaUploadLambda' });
const logger = getLogger();

const cwMetricScope = 'processMedia';

/**
 * Gets the handler for the processMediaUpload Lambda function.
 * @returns {Function} The Lambda function handler
 * @see https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html
 */
const getHandler = () => {
  /**
   * Processes a media file uploaded to S3.
   * @param {object} event The S3 event object
   * @param {object} context The Lambda execution context
   * @returns {Promise<void>}
   */
  return async (event, context) => {
    const mediaId = getMediaId(event.Records[0].s3.object.key);

    try {
      logger.info(`Processing media ${mediaId}.`);

      const { name: mediaName, width } = await setMediaStatusConditionally({
        mediaId,
        newStatus: MEDIA_STATUS.PROCESSING,
        expectedCurrentStatus: MEDIA_STATUS.PENDING,
      });

      logger.info('Media status set to PROCESSING');

      const image = await getMediaFile({ mediaId, mediaName });

      logger.info('Got media file');

      const mediaProcessingStart = performance.now();
      const resizeMedia = await processMediaWithSharp({
        imageBuffer: image,
        width,
      });
      const mediaProcessingEnd = performance.now();

      logger.info('Processed media');

      await uploadMediaToStorage({
        mediaId,
        mediaName,
        body: resizeMedia,
        keyPrefix: 'resized',
      });

      logger.info('Uploaded processed media');

      await setMediaStatusConditionally({
        mediaId,
        newStatus: MEDIA_STATUS.COMPLETE,
        expectedCurrentStatus: MEDIA_STATUS.PROCESSING,
      });

      logger.info(`Done processing media ${mediaId}.`);

      await publishGenericMetric({
        metricName: METRICS.MEDIA_ASYNC_PROCESSING_SUCCESS,
        scope: cwMetricScope,
        value: 1,
      });
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        logger.error(
          `Media ${mediaId} not found or status is not ${MEDIA_STATUS.PROCESSING}.`
        );

        await publishGenericMetric({
          metricName: METRICS.MEDIA_ASYNC_PROCESSING_FAILURE,
          scope: cwMetricScope,
          reason: 'CONDITIONAL_CHECK_FAILURE',
          value: 1,
        });

        throw error;
      }

      await setMediaStatus({
        mediaId,
        newStatus: MEDIA_STATUS.ERROR,
      });

      logger.error(`Failed to process media ${mediaId}`, error);

      await publishGenericMetric({
        metricName: METRICS.MEDIA_ASYNC_PROCESSING_FAILURE,
        scope: cwMetricScope,
        value: 1,
      });

      throw error;
    }
  };
};

/**
 * Resizes a media file to a specific width and converts it to JPEG format.
 * @param {object} param0 The function parameters
 * @param {Uint8Array} param0.imageBuffer The image buffer to resize
 * @param {string} width The size to resize the uploaded image to
 * @returns {Promise<Buffer>} The resized image buffer
 */
const processMediaWithSharp = async ({ imageBuffer, width }) => {
  const DEFAULT_IMAGE_WIDTH_PX = 500;
  const imageSizePx = parseInt(width) || DEFAULT_IMAGE_WIDTH_PX;
  return await sharp(imageBuffer)
    .resize(imageSizePx)
    .composite([
      {
        input: './hummingbird-watermark.png',
        gravity: 'southeast',
      },
    ])
    .toFormat('jpeg')
    .toBuffer();
};

const handler = withLogging(getHandler());

module.exports = { handler };
