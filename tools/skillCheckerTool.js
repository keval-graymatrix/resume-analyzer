const requiredSkills = ["JavaScript", "React", "Node.js", "SQL"];

export async function skillCheckerTool(providedSkills) {
  return requiredSkills.filter(skill => !providedSkills.includes(skill));
}
