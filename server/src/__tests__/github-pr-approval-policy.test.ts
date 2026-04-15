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
  it("allows allowlisted repository owners without final approval guidance", () => {
    const result = evaluateGitHubPrApproval({
      ...target,
      repositoryFullName: "Connsulting/widgets",
    });

    expect(result).toMatchObject({
      allowed: true,
      requiresFinalApproval: false,
      mergeEligible: true,
      owner: "connsulting",
      handoffComment: null,
    });
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
      githubPrApproved: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.mergeEligible).toBe(false);
    expect(result.message).toContain("QA status is pending");
  });

  it("blocks merge eligibility until GitHub PR approval is recorded", () => {
    const result = evaluateGitHubPrApproval({
      ...target,
      prUrl: "https://github.com/octo/widgets/pull/123",
      qaStatus: "passed",
    });

    expect(result.allowed).toBe(true);
    expect(result.mergeEligible).toBe(false);
    expect(result.message).toContain("not merge-eligible until board/user approval is recorded");
    expect(result.handoffComment).toContain("https://github.com/octo/widgets/pull/123");
    expect(result.handoffComment).toContain("- QA status: passed");
  });

  it("allows merge eligibility after QA passes and GitHub PR approval is recorded", () => {
    const result = evaluateGitHubPrApproval({
      ...target,
      prUrl: "https://github.com/octo/widgets/pull/123",
      qaStatus: "passed",
      githubPrApproved: true,
      approvedBy: "Board",
    });

    expect(result).toMatchObject({
      allowed: true,
      requiresFinalApproval: true,
      mergeEligible: true,
      handoffComment: null,
    });
    expect(result.message).toContain("approval is recorded by Board");
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
