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

// FIX: Explicitly define email as a union of z.string().email() and z.null()
const ExtractedDetailsSchema = z.object({
  email: z.union([z.string().email(), z.null()]).optional(),
  phone: z.union([z.string(), z.null()]).optional(),
  experience: z.union([z.array(ExperienceSchema), z.null()]).optional(),
  // NEW: Add totalExperienceInYears to the schema
  totalExperienceInYears: z.union([z.number(), z.null()]).optional(),
});

const MissingSkillsSchema = z.object({
  missingSkills: z.union([z.array(z.string()), z.null()]).optional(),
});

// FIX: Explicitly define fields in ResumeGraphState as unions
const ResumeGraphState = Annotation.Root({
  resumeText: Annotation(z.string()),
  email: Annotation(z.union([z.string().email(), z.null()]).optional()),
  phone: Annotation(z.union([z.string(), z.null()]).optional()),
  experience: Annotation(
    z.union([z.array(ExperienceSchema), z.null()]).optional()
  ),
  // NEW: Add totalExperienceInYears to the ResumeGraphState
  totalExperienceInYears: Annotation(
    z.union([z.number(), z.null()]).optional()
  ),
  route: Annotation(
    z.union([z.enum(["junior", "senior"]), z.null()]).optional()
  ),
  missingSkills: Annotation(
    z.union([z.array(z.string()), z.null()]).optional()
  ),
});

// Step 2: LLM instance
const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0.3 });

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
    "Input to extractDetails:",
    state.resumeText.substring(0, 100) + "..."
  ); // Log first 100 chars of resume

  const structuredLlm = llm.withStructuredOutput(ExtractedDetailsSchema);

  const prompt = [
    [
      "system",
      `You are a resume parser. Extract the following details: email, phone, and a list of work experiences. Each experience should include company, duration (e.g., "Month Year – Month Year"), role, and responsibilities.
    Infer the total years of experience from the durations and provide it as 'totalExperienceInYears' in a numerical format. If a duration is "Present", assume the end date is July 2025. Ensure all date durations are parsed into "Month Year – Month Year" format for consistency.
    Example JSON output:
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
      "totalExperienceInYears": 2.9
    }
    `,
    ],
    ["user", state.resumeText],
  ];

  const result = await structuredLlm.invoke(prompt);

  console.log("LLM Raw Extracted Details Result:", result);

  let totalExperienceMonths = 0;
  let totalExperienceYears = 0;

  // Make sure result.experience is an array before iterating
  if (result.experience && Array.isArray(result.experience)) {
    result.experience.forEach((exp) => {
      if (typeof exp.duration === "string" && exp.duration.includes(" – ")) {
        let [startMonthYearStr, endMonthYearStr] = exp.duration.split(" – ");

        // Handle "Present" for end date
        if (endMonthYearStr.toLowerCase() === "present") {
          endMonthYearStr = `July 2025`; // Using current time for 'Present'
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
    totalExperienceYears =
      totalExperienceMonths > 0 ? totalExperienceMonths / 12 : 0;
    totalExperienceYears = parseFloat(totalExperienceYears.toFixed(1)); // Round to one decimal place
  } else {
    console.log("No experience array or it's not an array.");
  }

  // Ensure totalExperienceInYears is directly from LLM if provided, otherwise our calculation
  const finalTotalExperience =
    result.totalExperienceInYears !== null &&
    result.totalExperienceInYears !== undefined
      ? result.totalExperienceInYears
      : totalExperienceYears;

  const newState = {
    email: result.email,
    phone: result.phone,
    experience: result.experience || [],
    totalExperienceInYears: finalTotalExperience, // Assign the calculated/provided total experience
    route: finalTotalExperience >= 3 ? "senior" : "junior",
  };

  console.log("Output from extractDetails Node:", newState);
  console.log("--- Exiting extractDetails Node ---");
  return newState;
}

// Step 4: Junior analysis with structured output
async function juniorAnalysis(state) {
  console.log("--- Entering juniorAnalysis Node ---");
  console.log("Input to juniorAnalysis (partial state):", {
    email: state.email,
    totalExperienceInYears: state.totalExperienceInYears,
  });

  const structuredLlm = llm.withStructuredOutput(MissingSkillsSchema);

  const result = await structuredLlm.invoke([
    [
      "system",
      'You are a career coach for junior developers. Analyze the resume and return a JSON array of 3 missing skills that would help them get better jobs. Example: {"missingSkills": ["AWS", "Docker", "CI/CD"]}',
    ],
    ["user", state.resumeText],
  ]);

  console.log("LLM Raw Missing Skills (Junior) Result:", result);

  const newState = {
    missingSkills: result.missingSkills || [],
  };
  console.log("Output from juniorAnalysis Node:", newState);
  console.log("--- Exiting juniorAnalysis Node ---");
  return newState;
}

// Step 5: Senior analysis with structured output
async function seniorAnalysis(state) {
  console.log("--- Entering seniorAnalysis Node ---");
  console.log("Input to seniorAnalysis (partial state):", {
    email: state.email,
    totalExperienceInYears: state.totalExperienceInYears,
  });

  const structuredLlm = llm.withStructuredOutput(MissingSkillsSchema);

  const result = await structuredLlm.invoke([
    [
      "system",
      'You are a career coach for senior engineers. Analyze the resume and return a JSON array of 3 missing leadership or advanced skills. Example: {"missingSkills": ["System Design", "Mentorship", "Project Management"]}',
    ],
    ["user", state.resumeText],
  ]);

  console.log("LLM Raw Missing Skills (Senior) Result:", result);

  const newState = {
    missingSkills: result.missingSkills || [],
  };
  console.log("Output from seniorAnalysis Node:", newState);
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
