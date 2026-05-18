const { body, validationResult } = require('express-validator');

/**
 * Returns validation errors as a standardized error response.
 * Use as the last middleware in a validation chain.
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request parameters.',
        details: errors.array().map((e) => ({
          field: e.path,
          message: e.msg,
        })),
      },
    });
  }
  return next();
}

// ── UUID format regex ──────────────────────────────────────────────────────
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates that a field matches UUID v4 format.
 * @param {string} field - The field name to validate.
 */
const isUUID = (field) =>
  body(field)
    .trim()
    .matches(UUID_REGEX)
    .withMessage(`${field} must be a valid UUID`);

/**
 * Validates that a field is a non-empty string with a max length.
 * @param {string} field - The field name.
 * @param {number} maxLen - Maximum allowed length.
 */
const isNonEmptyString = (field, maxLen = 500) =>
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${field} is required`)
    .isLength({ max: maxLen })
    .withMessage(`${field} must be at most ${maxLen} characters`);

/**
 * Validates that a field, if present, is a valid URL.
 * @param {string} field - The field name.
 */
const isOptionalUrl = (field) =>
  body(field)
    .optional({ values: 'null' })
    .trim()
    .isURL({ require_protocol: true })
    .withMessage(`${field} must be a valid URL`);

// ── Per-route validation chains ────────────────────────────────────────────

const createProjectRules = [
  isNonEmptyString('name', 200),
  isOptionalUrl('repoUrl'),
  body('localWorkspaceName').optional().trim().isLength({ max: 200 }),
  body('defaultBranch').optional().trim().isLength({ max: 100 }),
  handleValidation,
];

const createEpisodeRules = [
  isUUID('projectId'),
  isNonEmptyString('branchName', 200),
  body('label').optional().trim().isLength({ max: 500 }),
  handleValidation,
];

const logCallRules = [
  isUUID('projectId'),
  isUUID('episodeId'),
  isNonEmptyString('promptText', 50000),
  body('modelName').optional().trim().isLength({ max: 100 }),
  body('source').optional().isIn(['extension', 'git_commit', 'manual_log', 'chat']),
  body('modelResponse').optional().isLength({ max: 100000 }),
  body('branchName').optional().trim().isLength({ max: 200 }),
  body('activeFilePath').optional().trim().isLength({ max: 1000 }),
  body('customApiKey').optional().trim().isString(),
  handleValidation,
];

const explainRules = [
  isUUID('projectId'),
  isUUID('episodeId'),
  isNonEmptyString('diffHash', 128),
  body('changedFiles').optional().isArray({ max: 100 }),
  body('customApiKey').optional().trim().isString(),
  handleValidation,
];

const summarizeRules = [
  isUUID('projectId'),
  isNonEmptyString('branchName', 200),
  body('episodes').optional().isArray({ max: 200 }),
  body('customApiKey').optional().trim().isString(),
  handleValidation,
];

const searchRules = [
  isUUID('projectId'),
  body('q').optional().trim().isLength({ max: 500 }),
  handleValidation,
];

const closeEpisodeRules = [
  isUUID('projectId'),
  isUUID('episodeId'),
  handleValidation,
];

module.exports = {
  handleValidation,
  createProjectRules,
  createEpisodeRules,
  logCallRules,
  explainRules,
  summarizeRules,
  searchRules,
  closeEpisodeRules,
};
