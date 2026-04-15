import { z } from "zod";
import { APPROVAL_TYPES } from "../constants.js";

export const createApprovalSchema = z.object({
  type: z.enum(APPROVAL_TYPES),
  requestedByAgentId: z.string().uuid().optional().nullable(),
  payload: z.record(z.unknown()),
  issueIds: z.array(z.string().uuid()).optional(),
});

export type CreateApproval = z.infer<typeof createApprovalSchema>;

export const resolveApprovalSchema = z.object({
  decisionNote: z.string().optional().nullable(),
  decidedByUserId: z.string().optional().default("board"),
});

export type ResolveApproval = z.infer<typeof resolveApprovalSchema>;

export const requestApprovalRevisionSchema = z.object({
  decisionNote: z.string().optional().nullable(),
  decidedByUserId: z.string().optional().default("board"),
});

export type RequestApprovalRevision = z.infer<typeof requestApprovalRevisionSchema>;

export const resubmitApprovalSchema = z.object({
  payload: z.record(z.unknown()).optional(),
});

export type ResubmitApproval = z.infer<typeof resubmitApprovalSchema>;

export const addApprovalCommentSchema = z.object({
  body: z.string().min(1),
});

export type AddApprovalComment = z.infer<typeof addApprovalCommentSchema>;

export const githubPrPreApprovalSchema = z.object({
  repositoryFullName: z.string().trim().min(3).regex(/^[^/\s]+\/[^/\s]+$/, "Expected owner/repo"),
  owner: z.string().trim().min(1).optional().nullable(),
  baseBranch: z.string().trim().min(1),
  headBranch: z.string().trim().min(1),
  reason: z.string().trim().min(1).optional().nullable(),
  prUrl: z.string().trim().url().optional().nullable(),
  qaStatus: z.enum(["not_run", "pending", "passed", "failed"]).optional().nullable(),
  requestApprovalFrom: z.string().trim().min(1).optional().nullable(),
});

export type GitHubPrPreApproval = z.infer<typeof githubPrPreApprovalSchema>;
