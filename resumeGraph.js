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
  impact: z.union([z.number(), z.null()]).optional(), // Metric retained
  skills_score: z.union([z.number(), z.null()]).optional(), // Metric retained
  overall_score: z.union([z.number(), z.null()]).optional(), // Retained, calculation will change
  matched: z.union([z.boolean(), z.null()]).optional(),
  evaluation: z.union([z.array(QuestionAnswerSchema), z.null()]).optional(),
});

const MissingSkillsSchema = z.object({
  missingSkills: z.union([z.array(z.string()), z.null()]).optional(),
});

// Updated ResumeGraphState to exclude brevity and style
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
  impact: Annotation(z.union([z.number(), z.null()]).optional()),
  skills_score: Annotation(z.union([z.number(), z.null()]).optional()),
  overall_score: Annotation(z.union([z.number(), z.null()]).optional()),
  matched: Annotation(z.union([z.boolean(), z.null()]).optional()),
  evaluation: Annotation(
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

    **Provide scores out of 100 for the following metrics:**
    - Impact (e.g., quantifiable achievements, results)
    - Skills (relevance, depth, breadth of technical skills)

    **Calculate the Overall Score:** This should be the average of Impact and Skills scores.
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
      "impact": 75,
      "skills_score": 85,
      "overall_score": 80,
      "matched": true,
      "evaluation": [
        {"question": "Are there grammatical/spelling mistakes?", "answer": "no", "reason": "No obvious errors found."},
        {"question": "Well-organized and easy to read?", "answer": "yes", "reason": "Clear headings and bullet points make it scannable."}
        // ... all other questions
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

        // Current year in Mumbai, India
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
              1; // +1 to include the end month
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
    ); // Round to one decimal place
  } else {
    console.log("No experience array or it's not an array.");
  }

  // Use LLM's totalExperienceInYears if available, otherwise use calculated
  const finalTotalExperience =
    result.totalExperienceInYears !== null &&
    result.totalExperienceInYears !== undefined
      ? result.totalExperienceInYears
      : calculatedTotalExperienceYears;

  // Calculate Overall Score based on LLM's scores (Impact and Skills)
  let overallScore = null;
  if (result.impact !== null && result.skills_score !== null) {
    overallScore = (result.impact + result.skills_score) / 2; // Averaging only Impact and Skills
    overallScore = parseFloat(overallScore.toFixed(1)); // Round to one decimal
  }
  const matched = overallScore !== null ? overallScore > 60 : false;

  const newState = {
    email: result.email,
    phone: result.phone,
    experience: result.experience || [],
    totalExperienceInYears: finalTotalExperience,
    impact: result.impact,
    skills_score: result.skills_score,
    overall_score: overallScore, // Use calculated overall score
    matched: matched, // Use calculated matched status
    evaluation: result.evaluation || [],
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
