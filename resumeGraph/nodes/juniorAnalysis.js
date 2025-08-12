import { MissingSkillsSchema } from "../schemas.js";
import { llm } from "../llm.js";

export async function juniorAnalysis(state) {
  console.log("--- Entering juniorAnalysis Node ---");

  const structuredLlm = llm.withStructuredOutput(MissingSkillsSchema);
  const result = await structuredLlm.invoke([
    [
      "system",
      'You are a career coach for junior developers. Analyze the resume and return {"missingSkills": [...]}.',
    ],
    ["user", state.resumeText],
  ]);

  return { missingSkills: result.missingSkills || [] };
}
