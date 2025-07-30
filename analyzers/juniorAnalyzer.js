// juniorAnalyzer.js
export async function juniorAnalyzer(data) {
  return {
    level: "Junior",
    summary: `Candidate with ${data.experience} years experience. Suitable for junior roles.`,
    ...data,
  };
}
