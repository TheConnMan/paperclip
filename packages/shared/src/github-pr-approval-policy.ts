export const GITHUB_PR_APPROVAL_ALLOWED_OWNERS = ["connsulting", "theconnman"] as const;
export const GITHUB_PR_QA_STATUSES = ["not_run", "pending", "passed", "failed"] as const;

export type GitHubPrQaStatus = (typeof GITHUB_PR_QA_STATUSES)[number];

export interface GitHubPrApprovalTarget {
  repositoryFullName: string;
  owner?: string | null;
  baseBranch: string;
  headBranch: string;
  reason?: string | null;
  prUrl?: string | null;
  qaStatus?: GitHubPrQaStatus | null;
  githubPrApproved?: boolean | null;
  approvedBy?: string | null;
  requestApprovalFrom?: string | null;
}

export interface GitHubPrApprovalResult {
  allowed: boolean;
  requiresFinalApproval: boolean;
  mergeEligible: boolean;
  owner: string;
  repositoryFullName: string;
  message: string;
  handoffComment: string | null;
}

export function normalizeGitHubRepositoryOwner(owner: string): string {
  return owner.trim().toLowerCase();
}

export function getGitHubRepositoryOwner(input: Pick<GitHubPrApprovalTarget, "repositoryFullName" | "owner">): string {
  const explicitOwner = input.owner?.trim();
  if (explicitOwner) return normalizeGitHubRepositoryOwner(explicitOwner);

  const [owner] = input.repositoryFullName.trim().split("/");
  return normalizeGitHubRepositoryOwner(owner ?? "");
}

export function isGitHubPrApprovalAllowedOwner(owner: string): boolean {
  const normalizedOwner = normalizeGitHubRepositoryOwner(owner);
  return GITHUB_PR_APPROVAL_ALLOWED_OWNERS.includes(
    normalizedOwner as (typeof GITHUB_PR_APPROVAL_ALLOWED_OWNERS)[number],
  );
}

export function buildGitHubPrFinalApprovalHandoffComment(target: GitHubPrApprovalTarget): string {
  const owner = getGitHubRepositoryOwner(target);
  const repositoryFullName = target.repositoryFullName.trim();
  const prUrl = target.prUrl?.trim() || "<PR link required>";
  const qaStatus = normalizeQaStatus(target.qaStatus);
  const reviewer = target.requestApprovalFrom?.trim() || "board/user";
  const reason = target.reason?.trim() || "External GitHub repository PR requires final human approval before merge.";

  return [
    "## Final PR Approval Required",
    "",
    `Please review and approve the GitHub PR before merge: ${prUrl}`,
    "",
    `- Repository: ${repositoryFullName}`,
    `- Owner: ${owner}`,
    `- Base branch: ${target.baseBranch.trim()}`,
    `- Head branch: ${target.headBranch.trim()}`,
    `- QA status: ${qaStatus}`,
    `- Requested reviewer: ${reviewer}`,
    `- Reason: ${reason}`,
    "",
    "Do not merge until the GitHub PR approval is recorded on the PR.",
  ].join("\n");
}

export function evaluateGitHubPrApproval(target: GitHubPrApprovalTarget): GitHubPrApprovalResult {
  const repositoryFullName = target.repositoryFullName.trim();
  const owner = getGitHubRepositoryOwner(target);
  if (!owner || !repositoryFullName.includes("/")) {
    return {
      allowed: false,
      requiresFinalApproval: true,
      mergeEligible: false,
      owner,
      repositoryFullName,
      message: "GitHub PR preflight requires repositoryFullName in owner/repo form.",
      handoffComment: null,
    };
  }

  const allowlisted = isGitHubPrApprovalAllowedOwner(owner);
  const qaStatus = normalizeQaStatus(target.qaStatus);
  const prUrl = target.prUrl?.trim() ?? "";

  if (allowlisted) {
    return {
      allowed: true,
      requiresFinalApproval: false,
      mergeEligible: true,
      owner,
      repositoryFullName,
      message: `GitHub PR target ${repositoryFullName} is owned by allowlisted org ${owner}; PR creation is allowed without pre-open approval.`,
      handoffComment: null,
    };
  }

  const handoffComment = buildGitHubPrFinalApprovalHandoffComment({
    ...target,
    repositoryFullName,
    owner,
  });

  if (!prUrl) {
    return {
      allowed: true,
      requiresFinalApproval: true,
      mergeEligible: false,
      owner,
      repositoryFullName,
      message:
        `GitHub PR creation is allowed for ${repositoryFullName}. ` +
        "After the PR exists and QA has tested it, assign the ticket to the board/user with the PR link and request GitHub PR approval before merge.",
      handoffComment,
    };
  }

  if (qaStatus !== "passed") {
    return {
      allowed: true,
      requiresFinalApproval: true,
      mergeEligible: false,
      owner,
      repositoryFullName,
      message:
        `GitHub PR ${prUrl} is not merge-eligible because QA status is ${qaStatus}. ` +
        "Complete QA, then assign the ticket to the board/user for GitHub PR approval.",
      handoffComment,
    };
  }

  if (!target.githubPrApproved) {
    return {
      allowed: true,
      requiresFinalApproval: true,
      mergeEligible: false,
      owner,
      repositoryFullName,
      message:
        `GitHub PR ${prUrl} is not merge-eligible until board/user approval is recorded on the GitHub PR. ` +
        "Assign the ticket to the board/user with the PR link, QA status, and a direct request for PR approval.",
      handoffComment,
    };
  }

  return {
    allowed: true,
    requiresFinalApproval: true,
    mergeEligible: true,
    owner,
    repositoryFullName,
    message: `GitHub PR ${prUrl} is merge-eligible for ${repositoryFullName}; QA passed and GitHub PR approval is recorded${target.approvedBy?.trim() ? ` by ${target.approvedBy.trim()}` : ""}.`,
    handoffComment: null,
  };
}

function normalizeQaStatus(value: GitHubPrQaStatus | string | null | undefined): GitHubPrQaStatus {
  if (
    value === "not_run" ||
    value === "pending" ||
    value === "passed" ||
    value === "failed"
  ) {
    return value;
  }
  return "not_run";
}

export {
  GITHUB_PR_APPROVAL_ALLOWED_OWNERS as GITHUB_PR_PRE_APPROVAL_ALLOWED_OWNERS,
  evaluateGitHubPrApproval as evaluateGitHubPrPreApproval,
  isGitHubPrApprovalAllowedOwner as isGitHubPrPreApprovalAllowedOwner,
  type GitHubPrApprovalResult as GitHubPrPreApprovalResult,
  type GitHubPrApprovalTarget as GitHubPrPreApprovalTarget,
};
