const { deleteMedia } = require('../clients/dynamodb.js');
const { deleteMediaFile } = require('../clients/s3.js');
const { MEDIA_STATUS } = require('../constants.js');
const { getLogger } = require('../logger');

const logger = getLogger();

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

    await deleteMediaFile({ mediaId, mediaName });

    if (status !== MEDIA_STATUS.PROCESSING) {
      const keyPrefix = status === MEDIA_STATUS.ERROR ? 'uploads' : 'resized';
      await deleteMediaFile({
        mediaId,
        mediaName,
        keyPrefix,
      });
    }

    logger.info(`Deleted media with id ${mediaId}.`);
  } catch (error) {
    logger.error(`Error while deleting media with id ${mediaId}.`, error);
    throw error;
  }
};

module.exports = deleteMediaHandler;
