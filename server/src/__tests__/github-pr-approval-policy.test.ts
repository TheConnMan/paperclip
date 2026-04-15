import { describe, expect, it } from "vitest";
import {
  buildGitHubPrFinalApprovalHandoffComment,
  evaluateGitHubPrApproval,
  getGitHubRepositoryOwner,
} from "@paperclipai/shared";

const target = {
  repositoryFullName: "octo/widgets",
  baseBranch: "main",
  headBranch: "task/CON-71-external-pr-guardrail",
};

describe("github PR approval policy", () => {
  it("allows allowlisted repository owners to create PRs without reporting global merge readiness", () => {
    const result = evaluateGitHubPrApproval({
      ...target,
      repositoryFullName: "Connsulting/widgets",
    });

    expect(result).toMatchObject({
      allowed: true,
      prCreationAllowed: true,
      requiresFinalApproval: false,
      mergeEligible: false,
      mergeBlockedReason: "merge_eligibility_not_authoritative",
      approvalEvidenceVerified: false,
      owner: "connsulting",
      handoffComment: null,
    });
    expect(result.message).toContain("does not grant merge eligibility");
  });

  it("normalizes owner comparisons case-insensitively", () => {
    expect(getGitHubRepositoryOwner({ repositoryFullName: "TheConnMan/paperclip" })).toBe("theconnman");

    const result = evaluateGitHubPrApproval({
      ...target,
      repositoryFullName: "ignored/repo",
      owner: "THECONNMAN",
    });

    expect(result.allowed).toBe(true);
    expect(result.owner).toBe("theconnman");
  });

  it("allows non-allowlisted PR creation and returns final approval handoff guidance", () => {
    const result = evaluateGitHubPrApproval(target);

    expect(result.allowed).toBe(true);
    expect(result.requiresFinalApproval).toBe(true);
    expect(result.mergeEligible).toBe(false);
    expect(result.message).toContain("GitHub PR creation is allowed for octo/widgets");
    expect(result.message).toContain("assign the ticket to the board/user");
    expect(result.handoffComment).toContain("## Final PR Approval Required");
    expect(result.handoffComment).toContain("<PR link required>");
  });

  it("blocks merge eligibility for non-allowlisted PRs until QA passes", () => {
    const result = evaluateGitHubPrApproval({
      ...target,
      prUrl: "https://github.com/octo/widgets/pull/123",
      qaStatus: "pending",
    });

    expect(result.allowed).toBe(true);
    expect(result.mergeEligible).toBe(false);
    expect(result.mergeBlockedReason).toBe("qa_not_passed");
    expect(result.message).toContain("QA status is pending");
  });

  it("blocks merge eligibility until durable GitHub PR approval evidence is verified", () => {
    const result = evaluateGitHubPrApproval({
      ...target,
      prUrl: "https://github.com/octo/widgets/pull/123",
      qaStatus: "passed",
    });

    expect(result.allowed).toBe(true);
    expect(result.mergeEligible).toBe(false);
    expect(result.mergeBlockedReason).toBe("approval_evidence_not_verified");
    expect(result.message).toContain("has not verified durable GitHub PR approval evidence");
    expect(result.handoffComment).toContain("https://github.com/octo/widgets/pull/123");
    expect(result.handoffComment).toContain("- QA status: passed");
  });

  it("does not let caller-supplied approval make a non-allowlisted PR merge-eligible", () => {
    const result = evaluateGitHubPrApproval({
      ...target,
      prUrl: "https://github.com/octo/widgets/pull/123",
      qaStatus: "passed",
      githubPrApproved: true,
      approvedBy: "Board",
    } as Parameters<typeof evaluateGitHubPrApproval>[0] & { githubPrApproved: boolean; approvedBy: string });

    expect(result).toMatchObject({
      allowed: true,
      prCreationAllowed: true,
      requiresFinalApproval: true,
      mergeEligible: false,
      mergeBlockedReason: "approval_evidence_not_verified",
      approvalEvidenceVerified: false,
    });
    expect(result.message).toContain("has not verified durable GitHub PR approval evidence");
  });

  it("treats a QA-passed non-allowlisted PR as ready for final handoff only", () => {
    const result = evaluateGitHubPrApproval({
      ...target,
      prUrl: "https://github.com/octo/widgets/pull/123",
      qaStatus: "passed",
    });

    expect(result).toMatchObject({
      allowed: true,
      requiresFinalApproval: true,
      mergeEligible: false,
      handoffComment: expect.stringContaining("Final PR Approval Required"),
    });
    expect(result.message).toContain("ready for final board/user handoff");
  });

  it("builds handoff comments with PR link, QA status, and approval request", () => {
    const comment = buildGitHubPrFinalApprovalHandoffComment({
      ...target,
      prUrl: "https://github.com/octo/widgets/pull/123",
      qaStatus: "passed",
      requestApprovalFrom: "Brian",
      reason: "Final production review.",
    });

    expect(comment).toContain("https://github.com/octo/widgets/pull/123");
    expect(comment).toContain("- QA status: passed");
    expect(comment).toContain("- Requested reviewer: Brian");
    expect(comment).toContain("Do not merge until the GitHub PR approval is recorded");
  });
});
