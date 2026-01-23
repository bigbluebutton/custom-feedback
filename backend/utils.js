import url from "url";
import crypto from "crypto";

const activeKeys = [];

const apiPath = process.env.API_PATH || '/bigbluebutton/api/';
const REDIS_HASH_KEYS_EXPIRATION_IN_SECONDS = process.env.REDIS_HASH_KEYS_EXPIRATION_IN_SECONDS || 24 * 3600;
export const REASON_CODE_NOT_ELEGIBLE_FOR_FEEDBACK = [
  'max_participants_reason',
  'system_requested_eject_reason',
  'user_requested_eject_reason',
  'banned_user_rejoining_reason',
];
export const ERROR_CODE_NOT_ELEGIBLE_FOR_FEEDBACK = [
  'checkssumError',
  'invalidMeetingId',
  'meetingForciblyEnded',
  'invalidPassword',
  'mismatchCreateTime',
  'maxParticipantsReached',
  'guestDeniedAccess',
];

/**
 * queryFromUrl - Returns the query string from a URL string while preserving
 *                encoding.
 * @param {string} fullUrl - The URL to extract the query string from.
 * @returns {string} - The query string.
 * @private
 */
const queryFromUrl = (fullUrl) => {
  let query = fullUrl.replace(/&checksum=[^&]*/, '');
  query = query.replace(/checksum=[^&]*&/, '');
  query = query.replace(/checksum=[^&]*$/, '');
  const matched = query.match(/\?(.*)/);
  if (matched != null) {
    return matched[1];
  } else {
    return '';
  }
};

/**
 * methodFromUrl - Returns the API method string from a URL.
 * @param {string} fullUrl - The URL to extract the API method string from.
 * @returns {string} - The API method string.
 * @private
 */
const methodFromUrl = (fullUrl) => {
  const urlObj = url.parse(fullUrl, true);
  return urlObj.pathname.substr(apiPath.length);
};

/**
 * isChecksumAlgorithmSupported - Checks if a checksum algorithm is supported.
 * @param {string} algorithm - The algorithm to check.
 * @param {string} supported - The list of supported algorithms.
 * @returns {boolean} - Whether the algorithm is supported or not.
 * @private
 */
const isChecksumAlgorithmSupported = (algorithm, supported) => {
  if (supported == null || supported.length === 0) return false;
  return supported.indexOf(algorithm) !== -1;
};

/**
 * getChecksumAlgorithmFromLength - Returns the checksum algorithm that matches a checksum length.
 * @param {number} length - The length of the checksum.
 * @returns {string} - The checksum algorithm (one of sha1, sha256, sha384, sha512).
 * @private
 * @throws {Error} - If no algorithm could be found that matches the provided checksum length.
 */
const getChecksumAlgorithmFromLength = (length) => {
  switch (length) {
    case 40:
      return "sha1";
    case 64:
      return "sha256";
    case 96:
      return "sha384";
    case 128:
      return "sha512";
    default:
      throw new Error(`No algorithm could be found that matches the provided checksum length: ${length}`);
  }
};

/*
 * Public
 */

/**
 * ipFromRequest - Returns the IP address of the client that made a request `req`.
 *                 If can not determine the IP, returns `127.0.0.1`.
 * @param {object} req - The request object.
 * @returns {string} - The IP address of the client.
 * @public
 */
const ipFromRequest = (req) => {
  // the first ip in the list if the ip of the client
  // the others are proxys between him and us
  let ipAddress;
  if ((req.headers != null ? req.headers["x-forwarded-for"] : undefined) != null) {
    let ips = req.headers["x-forwarded-for"].split(",");
    ipAddress = ips[0] != null ? ips[0].trim() : undefined;
  }

  // fallbacks
  if (!ipAddress) { ipAddress = req.headers != null ? req.headers["x-real-ip"] : undefined; } // when behind nginx
  if (!ipAddress) { ipAddress = req.connection != null ? req.connection.remoteAddress : undefined; }
  if (!ipAddress) { ipAddress = "127.0.0.1"; }
  return ipAddress;
};

/**
 * shaHex - Calculates the SHA hash of a string.
 * @param {string} data - The string to calculate the hash for.
 * @param {string} algorithm - Hashing algorithm to use (sha1, sha256, sha384, sha512).
 * @returns {string} - The hash of the string.
 * @public
 */
const shaHex = (data, algorithm) => {
  return crypto.createHash(algorithm).update(data).digest("hex");
};

/**
 * checksumAPI - Calculates the checksum of a URL using a secret and a hashing algorithm.
 * @param {string} fullUrl - The URL to calculate the checksum for.
 * @param {string} salt - The secret to use for the checksum.
 * @param {string} algorithm - The hashing algorithm to use (sha1, sha256, sha384, sha512).
 * @returns {string} - The checksum of the URL.
 * @public
 */
const checksumAPI = (fullUrl, salt, algorithm) => {
  const query = queryFromUrl(fullUrl);
  const method = methodFromUrl(fullUrl);

  return shaHex(method + query + salt, algorithm);
};

/**
 * isUrlChecksumValid - Checks if the checksum of a URL is valid against a secret
 *                      and a hashing algorithm.
 * @param {string} urlStr - The URL to check.
 * @param {string} secret - The secret to use for the checksum.
 * @param {Array} supportedAlgorithms - The list of supported algorithms.
 * @returns {boolean} - Whether the checksum is valid or not.
 * @public
 */
const isUrlChecksumValid = (urlStr, secret, supportedAlgorithms) => {
  const urlObj = url.parse(urlStr, true);
  const checksum = urlObj.query["checksum"];
  const algorithm = getChecksumAlgorithmFromLength(checksum.length);

  if (!isChecksumAlgorithmSupported(algorithm, supportedAlgorithms)) {
    return false;
  }

  return checksum === checksumAPI(urlStr, secret, algorithm, supportedAlgorithms);
};

/**
 * isEmpty - Checks if an arbitrary value classifies as an empty array or object.
 * @param {*} obj - The value to check.
 * @returns {boolean} - Whether the value is empty or not.
 * @public
 */
const isEmpty = (obj) => [Object, Array].includes((obj || {}).constructor)
  && !Object.entries((obj || {})).length;

/**
 * sortBy - Sorts an array of objects by a key.
 * @param {string|number} key - The key to sort by.
 * @returns {Function} - A function that can be used to sort an array of objects by the given key.
 * @public
 */
const sortBy = (key) => (a, b) => {
  if (a[key] > b[key]) return 1;
  if (a[key] < b[key]) return -1;
  return 0;
};

/**
 * hSetWithExpiration - Adds an entry to the redis hash table and
 * assign an expiration time to that key
 * @param {import("redis").RedisClientType} redisClient - A connected Redis client instance.
 * @param {string} key - the key to store the value
 * @param {string} field - the field to be store
 * @param {object} options - options object
 * @param {number} options.expire_seconds - expiration time in seconds (default: 24 hours)
 * @param {boolean} options.trackActiveKeys - whether to track the active keys for cleanup (default: true)
 * @returns {Promise<void>}
 * @public
 */

const hSetWithExpiration = async (
  redisClient,
  key,
  field, {
    expire_seconds=REDIS_HASH_KEYS_EXPIRATION_IN_SECONDS,
    trackActiveKeys=true,
  } = {},
) => {
  if (trackActiveKeys) activeKeys.push(key);

  await redisClient.multi()
    .hSet(key, field)
    .expire(key, expire_seconds)
    .exec();
}

/**
 * redisStaleKeysCleanup - Removes keys from the hash table for a given keyId.
 * @param {import("redis").RedisClientType} redisClient - A connected Redis client instance
 * @param {string} keyId - The keyId to be removed. A keyId is a unique identifier
 *                         present at the end of keys (e.g. `feedback:<key>:<keyId>`).
 */
const redisStaleKeysCleanup = async (redisClient, keyId) => {
  if (!keyId) return;

  const { keysToDelete, keysToKeep } = activeKeys.reduce((acc, key) => {
    // searches for the keys containing the keyId
    // Keys have the following format:
    // - feedback:session:<keyId>
    // - feedback:user:<keyId>
    if (key.includes(keyId)) {
      acc.keysToDelete.push(key);
    } else {
      acc.keysToKeep.push(key);
    }
    return acc;
  }, { keysToDelete: [], keysToKeep: [] });

  await Promise.all(keysToDelete.map(key => redisClient.del(key)));
  activeKeys.splice(0, activeKeys.length, ...keysToKeep);
}

export default {
  ipFromRequest,
  shaHex,
  checksumAPI,
  isUrlChecksumValid,
  isEmpty,
  sortBy,
  hSetWithExpiration,
  redisStaleKeysCleanup,
};
