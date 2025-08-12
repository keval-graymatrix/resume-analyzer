import { z } from "zod";
import { Annotation } from "@langchain/langgraph";

export const ExperienceSchema = z.object({
  company: z.string(),
  duration: z.string(),
  role: z.string(),
  responsibilities: z.array(z.string()),
});

export const QuestionAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(),
  reason: z.string(),
});

export const ExtractedDetailsSchema = z.object({
  email: z.union([z.string().email(), z.null()]).optional(),
  phone: z.union([z.string(), z.null()]).optional(),
  experience: z.union([z.array(ExperienceSchema), z.null()]).optional(),
  totalExperienceInYears: z.union([z.number(), z.null()]).optional(),
  summary: z.union([z.string(), z.null()]).optional(),
  strengths: z.union([z.array(z.string()), z.null()]).optional(),
  weaknesses: z.union([z.array(z.string()), z.null()]).optional(),
  suggested_roles: z.union([z.array(z.string()), z.null()]).optional(),
  skill_gaps: z.union([z.array(z.string()), z.null()]).optional(),
  impact: z.union([z.number(), z.null()]).optional(),
  skills_score: z.union([z.number(), z.null()]).optional(),
  overall_score: z.union([z.number(), z.null()]).optional(),
  matched: z.union([z.boolean(), z.null()]).optional(),
  evaluation: z.union([z.array(QuestionAnswerSchema), z.null()]).optional(),
});

export const MissingSkillsSchema = z.object({
  missingSkills: z.union([z.array(z.string()), z.null()]).optional(),
});

export const ResumeGraphState = Annotation.Root({
  resumeText: Annotation(z.string()),
  email: Annotation(z.union([z.string().email(), z.null()]).optional()),
  phone: Annotation(z.union([z.string(), z.null()]).optional()),
  experience: Annotation(
    z.union([z.array(ExperienceSchema), z.null()]).optional()
  ),
  totalExperienceInYears: Annotation(
    z.union([z.number(), z.null()]).optional()
  ),
  summary: Annotation(z.union([z.string(), z.null()]).optional()),
  strengths: Annotation(z.union([z.array(z.string()), z.null()]).optional()),
  weaknesses: Annotation(z.union([z.array(z.string()), z.null()]).optional()),
  suggested_roles: Annotation(
    z.union([z.array(z.string()), z.null()]).optional()
  ),
  skill_gaps: Annotation(z.union([z.array(z.string()), z.null()]).optional()),
  impact: Annotation(z.union([z.number(), z.null()]).optional()),
  skills_score: Annotation(z.union([z.number(), z.null()]).optional()),
  overall_score: Annotation(z.union([z.number(), z.null()]).optional()),
  matched: Annotation(z.union([z.boolean(), z.null()]).optional()),
  questions_answers: Annotation(
    z.union([z.array(QuestionAnswerSchema), z.null()]).optional()
  ),
  route: Annotation(
    z.union([z.enum(["junior", "senior"]), z.null()]).optional()
  ),
  missingSkills: Annotation(
    z.union([z.array(z.string()), z.null()]).optional()
  ),
});
