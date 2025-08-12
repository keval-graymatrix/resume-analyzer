import { StateGraph } from "@langchain/langgraph";
import { ResumeGraphState } from "./schemas.js";
import { extractDetails } from "./nodes/extractDetails.js";
import { juniorAnalysis } from "./nodes/juniorAnalysis.js";
import { seniorAnalysis } from "./nodes/seniorAnalysis.js";
import { routeDecision } from "./nodes/routeDecision.js";

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
