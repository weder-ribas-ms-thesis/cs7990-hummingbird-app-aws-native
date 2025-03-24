const { Transform } = require('node:stream');
const { randomUUID } = require('node:crypto');
const { formidable, errors: formidableErrors } = require('formidable');
const { uploadMediaToStorage } = require('../clients/s3.js');
const {
  MAX_FILE_SIZE,
  CUSTOM_FORMIDABLE_ERRORS,
} = require('../core/constants.js');
const { publishMetric } = require('../clients/cloudwatch.js');
const { getLogger } = require('../logger.js');

const logger = getLogger();

/**
 * Uploads a media file to AWS S3 in a streaming fashion.
 * @param {Request} req Express.js (Node) HTTP request object.
 * @returns {Promise<string>} The file ID.
 */
const uploadMedia = async (req) => {
  return new Promise((resolve, reject) => {
    try {
      const mediaId = randomUUID();

      const form = formidable({
        maxFiles: 1,
        minFileSize: 1,
        maxFileSize: MAX_FILE_SIZE,
        keepExtensions: true,
        filter: ({ mimetype }) => {
          const isImage = mimetype && mimetype.startsWith('image');
          if (!isImage) {
            const { code, httpCode } =
              CUSTOM_FORMIDABLE_ERRORS.INVALID_FILE_TYPE;
            const error = new formidableErrors.default(
              'invalidFileType',
              code,
              httpCode
            );
            form.emit('error', error);
            return false;
          }

          return true;
        },
      });

      form.parse(req, (error, fields, files) => {
        if (!Object.keys(files).length) {
          const error = new formidableErrors.default(
            'noFilesFound',
            formidableErrors.malformedMultipart,
            400
          );
          form.emit('error', error);
          return;
        }

        if (error) {
          reject(error);
        }
      });

      form.on('fileBegin', (name, file) => {
        /*
         * Override the default file.open and file.end functions.
         * The file is uploaded S3 once it's open with a stream.
         */
        file.open = function () {
          this._writeStream = new Transform({
            transform(chunk, encoding, callback) {
              this.push(chunk);
              callback();
            },
          });

          this._writeStream.on('error', (error) => {
            form.emit('error', error);
          });

          uploadMediaToStorage({
            mediaId,
            mediaName: file.originalFilename,
            body: this._writeStream,
          })
            .then(() => {
              form.emit('data', { event: 'done', file });
            })
            .catch((error) => {
              form.emit('error', error);
            });
        };

        file.end = function (callback) {
          this._writeStream.on('finish', () => {
            this.emit('end');
            callback();
          });
          this._writeStream.end();
        };
      });

      form.on('error', async (error) => {
        await publishUploadMetric({
          metricName: 'MediaUploadFailure',
          value: 1,
        });
        reject(error);
      });

      form.on('data', async (data) => {
        if (data.event === 'done') {
          await publishUploadMetric({
            metricName: 'MediaUploadSuccess',
            value: 1,
          });
          resolve({ mediaId, file: data.file.toJSON() });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Publishes the media upload metric to CloudWatch.
 * @param {string} metricName
 * @param {number} value
 * @returns {Promise<void>}
 */
const publishUploadMetric = async ({ metricName, value }) => {
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
          ],
        },
      ],
    });
  } catch (error) {
    logger.error('Failed to publish media upload metric', error);
  }
};

module.exports = { uploadMedia };
