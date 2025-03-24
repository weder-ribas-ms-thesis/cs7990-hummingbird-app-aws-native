const { deleteMedia } = require('../clients/dynamodb.js');
const { deleteMediaFile } = require('../clients/s3.js');
const { MEDIA_STATUS } = require('../constants.js');
const { getLogger } = require('../logger.js');
const { publishGenericMetric } = require('../common.js');
const { METRICS } = require('../constants.js');

const logger = getLogger();

const cwMetricScope = 'deleteMedia';

/**
 * Delete media from storage.
 * @param {object} param0 The function parameters
 * @param {string} param0.mediaId The media ID for deletion
 * @returns {Promise<void>}
 */
const deleteMediaHandler = async ({ mediaId }) => {
  if (!mediaId) {
    logger.info('Skipping delete media message with no mediaId.');
    return;
  }

  logger.info(`Deleting media with id ${mediaId}.`);

  try {
    const { name: mediaName, status } = await deleteMedia(mediaId);

    if (!mediaName) {
      logger.info(`Media with id ${mediaId} not found.`);
      return;
    }

    await deleteMediaFile({ mediaId, mediaName, keyPrefix: 'uploads' });

    if (status === MEDIA_STATUS.COMPLETE) {
      await deleteMediaFile({
        mediaId,
        mediaName,
        keyPrefix: 'resized',
      });
    }

    logger.info(`Deleted media with id ${mediaId}.`);

    await publishGenericMetric({
      metricName: METRICS.MEDIA_ASYNC_PROCESSING_SUCCESS,
      scope: cwMetricScope,
      value: 1,
    });
  } catch (error) {
    logger.error(`Error while deleting media with id ${mediaId}.`, error);

    await publishGenericMetric({
      metricName: METRICS.MEDIA_ASYNC_PROCESSING_FAILURE,
      scope: cwMetricScope,
      value: 1,
    });

    throw error;
  }
};

module.exports = deleteMediaHandler;
