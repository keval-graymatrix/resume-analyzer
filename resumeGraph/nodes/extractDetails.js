// resumeGraph/nodes/extractDetails.js
import { ExtractedDetailsSchema } from "../schemas.js";
import { getMonthNumber } from "../helpers.js";
import { llm } from "../llm.js";

export async function extractDetails(state) {
  console.log("--- Entering extractDetails Node ---");

  const structuredLlm = llm.withStructuredOutput(ExtractedDetailsSchema);
  const prompt = [
    [
      "system",
      `You are a highly skilled resume analyzer. Your task is to extract specific details and evaluate the resume based on a set of criteria.
  
      **Extract the following core details:**
      - Email
      - Phone number
      - A list of work experiences. Each experience should include:
          - company: Name of the company
          - duration: Duration of employment (e.g., "Month Year – Month Year"). If "Present" is used, assume the end date is July 2025.
          - role: Candidate's role at the company
          - responsibilities: An array of key responsibilities/achievements.
      - totalExperienceInYears: The total professional experience in years, inferred from the durations. Round to one decimal place.
  
      **Provide a detailed analysis based on the resume content:**
      - summary: A brief paragraph summarizing the candidate's profile.
      - strengths: An array of bullet points highlighting key strengths.
      - weaknesses: An array of bullet points highlighting potential weaknesses.
      - suggested_roles: An array of suitable job titles for the candidate.
      - skill_gaps: An array of technical skills or areas for improvement.
  
      **Evaluate the resume based on the following questions and provide 'yes' or 'no' answers, along with a brief 'reason' for your answer:**
      - Are there grammatical/spelling mistakes?
      - Well-organized and easy to read?
      - Continuous learning through education?
      - Mentions of self learning projects?
      - Staying current with industry trends?
      - Public repos/open-source contributions?
      - Technical complexity over time?
      - Mastery in multiple technical domains?
      - Clear progression in responsibility scope?
      - Significant work history gaps?
  
      **Provide scores for the following metrics:**
      - impact: Score out of 100 (e.g., quantifiable achievements, results).
      - skills_score: Technical Skills score out of 100 (relevance, depth, breadth).
      - experience_level_score: Experience Level score out of 10 (based on years and quality).
      - leadership_potential_score: Leadership Potential score out of 10.
      - adaptability_score: Adaptability score out of 10.
  
      **Calculate the Overall Score:** This should be the average of 'impact', 'skills_score', 'experience_level_score', 'leadership_potential_score', and 'adaptability_score'.
      **Determine 'Matched' status:** Set to true if Overall Score is > 60, otherwise false.
  
      **Ensure your output is a JSON object conforming to the provided schema.**
      Example JSON structure:
      {
        "email": "test@example.com",
        "phone": "1234567890",
        "experience": [
          {
            "company": "ABC Corp",
            "duration": "January 2020 – December 2022",
            "role": "Software Engineer",
            "responsibilities": ["Developed X", "Managed Y"]
          }
        ],
        "totalExperienceInYears": 2.9,
        "summary": "Experienced software engineer with...",
        "strengths": ["Excellent technical skills..."],
        "weaknesses": ["Limited experience in..."],
        "suggested_roles": ["Senior Frontend Developer", "Full-Stack Engineer"],
        "skill_gaps": ["React Native or Flutter..."],
        "impact": 75,
        "skills_score": 85,
        "experience_level_score": 8,
        "leadership_potential_score": 7,
        "adaptability_score": 8,
        "overall_score": 77.5,
        "matched": true,
        "questions_answers": [
          {"question": "Are there grammatical/spelling mistakes?", "answer": "no", "reason": "No obvious errors found."},
          {"question": "Well-organized and easy to read?", "answer": "yes", "reason": "Clear headings and bullet points make it scannable."}
          // ... all other questions with reasons
        ]
      }
      `,
    ],
    ["user", state.resumeText],
  ];

  const result = await structuredLlm.invoke(prompt);

  // Total experience calculation
  let totalExperienceMonths = 0;
  if (result.experience && Array.isArray(result.experience)) {
    result.experience.forEach((exp) => {
      if (typeof exp.duration === "string" && exp.duration.includes(" – ")) {
        let [startMonthYearStr, endMonthYearStr] = exp.duration.split(" – ");
        const currentDate = new Date();
        if (endMonthYearStr.toLowerCase() === "present") {
          endMonthYearStr = `${currentDate.toLocaleString("en-US", {
            month: "long",
          })} ${currentDate.getFullYear()}`;
        }
        const [startMonthName, startYearStr] = startMonthYearStr.split(" ");
        const [endMonthName, endYearStr] = endMonthYearStr.split(" ");
        const startMonth = getMonthNumber(startMonthName);
        const endMonth = getMonthNumber(endMonthName);
        const startYear = parseInt(startYearStr, 10);
        const endYear = parseInt(endYearStr, 10);

        if (
          !isNaN(startMonth) &&
          !isNaN(startYear) &&
          !isNaN(endMonth) &&
          !isNaN(endYear)
        ) {
          const startDate = new Date(startYear, startMonth, 1);
          const endDate = new Date(endYear, endMonth, 1);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            totalExperienceMonths +=
              (endDate.getFullYear() - startDate.getFullYear()) * 12 +
              (endDate.getMonth() - startDate.getMonth()) +
              1;
          }
        }
      }
    });
  }
  const calculatedTotalExperienceYears =
    totalExperienceMonths > 0
      ? parseFloat((totalExperienceMonths / 12).toFixed(1))
      : 0;

  const finalTotalExperience =
    result.totalExperienceInYears ?? calculatedTotalExperienceYears;

  const overallScore =
    result.impact !== null && result.skills_score !== null
      ? parseFloat(((result.impact + result.skills_score) / 2).toFixed(1))
      : result.overall_score;

  const matched =
    overallScore !== null ? overallScore > 60 : result.overall_score > 60;

  const newState = {
    email: result.email,
    phone: result.phone,
    experience: result.experience || [],
    totalExperienceInYears: finalTotalExperience,
    summary: result.summary,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    suggested_roles: result.suggested_roles,
    skill_gaps: result.skill_gaps,
    impact: result.impact,
    skills_score: result.skills_score,
    overall_score: overallScore,
    matched: matched,
    questions_answers: result.evaluation || [],
    route: finalTotalExperience >= 3 ? "senior" : "junior",
  };

  console.log("--- Exiting extractDetails Node ---");
  return newState;
}
