import { MissingSkillsSchema } from "../schemas.js";
import { llm } from "../llm.js";

export async function seniorAnalysis(state) {
  console.log("--- Entering seniorAnalysis Node ---");

  const structuredLlm = llm.withStructuredOutput(MissingSkillsSchema);
  const result = await structuredLlm.invoke([
    [
      "system",
      'You are a career coach for senior engineers. Analyze the resume and return {"missingSkills": [...]}.',
    ],
    ["user", state.resumeText],
  ]);

  return { missingSkills: result.missingSkills || [] };
}
