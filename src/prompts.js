/**
 * Template for generating a prompt to explain a code diff.
 * 
 * @param {Object} params - The template parameters.
 * @param {string} params.changedFilesList - A comma-separated list of changed files.
 * @returns {string} The formatted prompt.
 */
const explainDiffTemplate = ({ changedFilesList }) => `You are an assistant that explains code diffs.
- What changed: summarize the changes across files: ${changedFilesList}
- Why it likely changed: explain intent and reason.
- What might break: list plausible breakages and edge cases.
- What should be tested: provide focused tests.

Return strictly JSON with keys: summary, risks (array), checks (array).
`;

/**
 * Template for generating a prompt to summarize branch activity.
 * 
 * @param {Object} params - The template parameters.
 * @param {string} params.episodesSummaryList - A list of episode summaries.
 * @returns {string} The formatted prompt.
 */
const branchSummaryTemplate = ({ episodesSummaryList }) => `You are an assistant that summarizes a branch / PR.
- What the PR does: aggregate: ${episodesSummaryList}
- Key changes: enumerate
- Review risks: list

Return strictly JSON with keys: pr_summary, key_changes (array), review_risks (array).
`;

module.exports = { explainDiffTemplate, branchSummaryTemplate };
