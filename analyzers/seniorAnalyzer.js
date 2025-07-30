// seniorAnalyzer.js
export async function seniorAnalyzer(data) {
  return {
    level: "Senior",
    summary: `Candidate with ${data.experience} years experience. Good fit for senior roles.`,
    ...data,
  };
}
