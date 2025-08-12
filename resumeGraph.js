import { StateGraph, Annotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

// Step 1: Define the state schema
const ExperienceSchema = z.object({
  company: z.string(),
  duration: z.string(),
  role: z.string(),
  responsibilities: z.array(z.string()),
});

// Schema for the individual question/answer pairs
const QuestionAnswerSchema = z.object({
  question: z.string(),
  answer: z.string(), // "yes" or "no"
  reason: z.string(), // NEW: Added reason field
});

// Updated ExtractedDetailsSchema to exclude brevity and style
const ExtractedDetailsSchema = z.object({
  email: z.union([z.string().email(), z.null()]).optional(),
  phone: z.union([z.string(), z.null()]).optional(),
  experience: z.union([z.array(ExperienceSchema), z.null()]).optional(),
  totalExperienceInYears: z.union([z.number(), z.null()]).optional(),

  // New summary and analysis fields from images
  summary: z.union([z.string(), z.null()]).optional(),
  strengths: z.union([z.array(z.string()), z.null()]).optional(),
  weaknesses: z.union([z.array(z.string()), z.null()]).optional(),
  suggested_roles: z.union([z.array(z.string()), z.null()]).optional(),
  skill_gaps: z.union([z.array(z.string()), z.null()]).optional(),

  impact: z.union([z.number(), z.null()]).optional(), // Metric retained
  skills_score: z.union([z.number(), z.null()]).optional(), // Metric retained
  overall_score: z.union([z.number(), z.null()]).optional(), // Retained, calculation will change
  matched: z.union([z.boolean(), z.null()]).optional(),
  evaluation: z.union([z.array(QuestionAnswerSchema), z.null()]).optional(),
});

const MissingSkillsSchema = z.object({
  missingSkills: z.union([z.array(z.string()), z.null()]).optional(),
});

// UPDATED: ResumeGraphState to mirror the new metrics and Youtubes schema
const ResumeGraphState = Annotation.Root({
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
  // experience_level_score: Annotation(
  //   z.union([z.number(), z.null()]).optional()
  // ),
  // leadership_potential_score: Annotation(
  //   z.union([z.number(), z.null()]).optional()
  // ),
  // adaptability_score: Annotation(z.union([z.number(), z.null()]).optional()),
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

// Step 2: LLM instance
const llm = new ChatOpenAI({ model: "gpt-4.1-mini", temperature: 0.1 });

// Helper function to parse month name to number
function getMonthNumber(monthName) {
  const months = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11,
  };
  return months[monthName];
}

// Step 3: Extract details using LLM with structured output
async function extractDetails(state) {
  console.log("--- Entering extractDetails Node ---");
  console.log(
    "Input to extractDetails (first 100 chars of resume):",
    state.resumeText.substring(0, 100) + "..."
  );

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

  console.log(
    "LLM Raw Extracted Details Result:",
    JSON.stringify(result, null, 2)
  );

  let totalExperienceMonths = 0;
  let calculatedTotalExperienceYears = 0;

  if (result.experience && Array.isArray(result.experience)) {
    result.experience.forEach((exp) => {
      if (typeof exp.duration === "string" && exp.duration.includes(" – ")) {
        let [startMonthYearStr, endMonthYearStr] = exp.duration.split(" – ");
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.toLocaleString("en-US", {
          month: "long",
        });

        if (endMonthYearStr.toLowerCase() === "present") {
          endMonthYearStr = `${currentMonth} ${currentYear}`;
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
          } else {
            console.warn(
              `Invalid date components for duration: ${exp.duration}`
            );
          }
        } else {
          console.warn(
            `Could not parse month/year from duration: ${exp.duration}`
          );
        }
      } else {
        console.warn(`Invalid duration format for experience: ${exp.duration}`);
      }
    });
    calculatedTotalExperienceYears =
      totalExperienceMonths > 0 ? totalExperienceMonths / 12 : 0;
    calculatedTotalExperienceYears = parseFloat(
      calculatedTotalExperienceYears.toFixed(1)
    );
  } else {
    console.log("No experience array or it's not an array.");
  }

  const finalTotalExperience =
    result.totalExperienceInYears !== null &&
    result.totalExperienceInYears !== undefined
      ? result.totalExperienceInYears
      : calculatedTotalExperienceYears;

  // UPDATED: Calculate Overall Score using all new scores
  let overallScore = null;
  if (
    result.impact !== null &&
    result.skills_score !== null
    // result.experience_level_score !== null &&
    // result.leadership_potential_score !== null &&
    // result.adaptability_score !== null
  ) {
    // Normalize scores to a 100-point scale for a consistent average
    const impactScore = result.impact; // Already out of 100
    const skillsScore = result.skills_score; // Already out of 100
    // const experienceScore = result.experience_level_score * 10; // Convert 1-10 to 1-100
    // const leadershipScore = result.leadership_potential_score * 10; // Convert 1-10 to 1-100
    // const adaptabilityScore = result.adaptability_score * 10; // Convert 1-10 to 1-100

    overallScore = (impactScore + skillsScore) / 2;
    // +
    // experienceScore +
    // leadershipScore +
    // adaptabilityScore

    overallScore = parseFloat(overallScore.toFixed(1));
  }
  const matched =
    overallScore !== null
      ? overallScore > 60
      : result.overall_score > 60
      ? true
      : false;

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
    // experience_level_score: result.experience_level_score,
    // leadership_potential_score: result.leadership_potential_score,
    // adaptability_score: result.adaptability_score,
    overall_score: overallScore,
    matched: matched,
    questions_answers: result.evaluation || [],
    route: finalTotalExperience >= 3 ? "senior" : "junior",
  };

  console.log(
    "Output from extractDetails Node:",
    JSON.stringify(newState, null, 2)
  );
  console.log("--- Exiting extractDetails Node ---");
  return newState;
}

// Step 4: Junior analysis with structured output
async function juniorAnalysis(state) {
  console.log("--- Entering juniorAnalysis Node ---");
  console.log("Input to juniorAnalysis (partial state):", {
    email: state.email,
    totalExperienceInYears: state.totalExperienceInYears,
    overall_score: state.overall_score,
    matched: state.matched,
    evaluation: state.evaluation,
  });

  const structuredLlm = llm.withStructuredOutput(MissingSkillsSchema);

  const result = await structuredLlm.invoke([
    [
      "system",
      'You are a career coach for junior developers. Analyze the resume and return a JSON array of 3 missing skills that would help them get better jobs. Example: {"missingSkills": ["AWS", "Docker", "CI/CD"]}',
    ],
    ["user", state.resumeText],
  ]);

  console.log(
    "LLM Raw Missing Skills (Junior) Result:",
    JSON.stringify(result, null, 2)
  );

  const newState = {
    missingSkills: result.missingSkills || [],
  };
  console.log(
    "Output from juniorAnalysis Node:",
    JSON.stringify(newState, null, 2)
  );
  console.log("--- Exiting juniorAnalysis Node ---");
  return newState;
}

// Step 5: Senior analysis with structured output
async function seniorAnalysis(state) {
  console.log("--- Entering seniorAnalysis Node ---");
  console.log("Input to seniorAnalysis (partial state):", {
    email: state.email,
    totalExperienceInYears: state.totalExperienceInYears,
    overall_score: state.overall_score,
    matched: state.matched,
    evaluation: state.evaluation,
  });

  const structuredLlm = llm.withStructuredOutput(MissingSkillsSchema);

  const result = await structuredLlm.invoke([
    [
      "system",
      'You are a career coach for senior engineers. Analyze the resume and return a JSON array of 3 missing leadership or advanced skills. Example: {"missingSkills": ["System Design", "Mentorship", "Project Management"]}',
    ],
    ["user", state.resumeText],
  ]);

  console.log(
    "LLM Raw Missing Skills (Senior) Result:",
    JSON.stringify(result, null, 2)
  );

  const newState = {
    missingSkills: result.missingSkills || [],
  };
  console.log(
    "Output from seniorAnalysis Node:",
    JSON.stringify(newState, null, 2)
  );
  console.log("--- Exiting seniorAnalysis Node ---");
  return newState;
}

// Step 6: Routing function (decides which path to go)
function routeDecision(state) {
  console.log("--- Entering routeDecision Node ---");
  console.log(
    "Input to routeDecision (totalExperienceInYears):",
    state.totalExperienceInYears
  );
  const decision =
    state.route === "senior" ? "seniorAnalysis" : "juniorAnalysis";
  console.log("Route Decision:", decision);
  console.log("--- Exiting routeDecision Node ---");
  return decision;
}

// Step 7: Build the graph
export const buildResumeGraph = () => {
  console.log("Building Resume Graph...");
  return new StateGraph(ResumeGraphState)
    .addNode("extractDetails", extractDetails)
    .addNode("juniorAnalysis", juniorAnalysis)
    .addNode("seniorAnalysis", seniorAnalysis)
    .addConditionalEdges("extractDetails", routeDecision, [
      "juniorAnalysis",
      "seniorAnalysis",
    ])
    .addEdge("__start__", "extractDetails")
    .addEdge("juniorAnalysis", "__end__")
    .addEdge("seniorAnalysis", "__end__")
    .compile();
};
