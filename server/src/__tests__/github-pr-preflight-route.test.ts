import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIssueService = vi.hoisted(() => ({
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
  accessService: () => ({}),
  agentService: () => ({}),
  documentService: () => ({}),
  executionWorkspaceService: () => ({}),
  feedbackService: () => ({}),
  goalService: () => ({}),
  heartbeatService: () => ({}),
  instanceSettingsService: () => ({}),
  issueApprovalService: () => ({}),
  issueService: () => mockIssueService,
  logActivity: vi.fn(),
  projectService: () => ({}),
  routineService: () => ({}),
  workProductService: () => ({}),
}));

async function createApp() {
  const [{ issueRoutes }] = await Promise.all([
    vi.importActual<typeof import("../routes/issues.js")>("../routes/issues.js"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = {
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      source: "api_key",
      isInstanceAdmin: false,
    };
    next();
  });
  app.use("/api", issueRoutes({} as any, {} as any));
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status((err as { status?: number }).status ?? 500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  });
  return app;
}

describe("GitHub PR preflight route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueService.getById.mockResolvedValue({
      id: "issue-1",
      companyId: "company-1",
      title: "Issue",
      status: "in_progress",
      priority: "high",
    });
    mockIssueService.getByIdentifier.mockResolvedValue(null);
  });

  it("allows allowlisted PR creation without reporting global merge readiness", async () => {
    const res = await request(await createApp())
      .post("/api/issues/issue-1/github-pr-preflight")
      .send({
        repositoryFullName: "TheConnMan/paperclip",
        baseBranch: "master",
        headBranch: "task/CON-71-external-pr-guardrail",
      });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.allowed).toBe(true);
    expect(res.body.prCreationAllowed).toBe(true);
    expect(res.body.requiresFinalApproval).toBe(false);
    expect(res.body.mergeEligible).toBe(false);
    expect(res.body.mergeBlockedReason).toBe("merge_eligibility_not_authoritative");
  });

  it("allows non-allowlisted PR creation while requiring final PR approval", async () => {
    const res = await request(await createApp())
      .post("/api/issues/issue-1/github-pr-preflight")
      .send({
        repositoryFullName: "paperclipai/paperclip",
        baseBranch: "master",
        headBranch: "task/CON-71-external-pr-guardrail",
      });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.allowed).toBe(true);
    expect(res.body.requiresFinalApproval).toBe(true);
    expect(res.body.mergeEligible).toBe(false);
    expect(res.body.message).toContain("GitHub PR creation is allowed for paperclipai/paperclip");
    expect(res.body.handoffComment).toContain("Final PR Approval Required");
  });

  it("does not treat caller-supplied GitHub approval as verified merge evidence", async () => {
    const res = await request(await createApp())
      .post("/api/issues/issue-1/github-pr-preflight")
      .send({
        repositoryFullName: "paperclipai/paperclip",
        baseBranch: "master",
        headBranch: "task/CON-71-external-pr-guardrail",
        prUrl: "https://github.com/paperclipai/paperclip/pull/1",
        qaStatus: "passed",
        githubPrApproved: true,
        approvedBy: "Board",
      });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({
      allowed: true,
      prCreationAllowed: true,
      requiresFinalApproval: true,
      mergeEligible: false,
      mergeBlockedReason: "approval_evidence_not_verified",
      approvalEvidenceVerified: false,
      handoffComment: expect.stringContaining("Final PR Approval Required"),
    });
    expect(res.body.message).toContain("has not verified durable GitHub PR approval evidence");
  });
});
