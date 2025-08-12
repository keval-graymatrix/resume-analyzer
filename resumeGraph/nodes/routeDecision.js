export function routeDecision(state) {
  console.log("--- Entering routeDecision Node ---");
  return state.route === "senior" ? "seniorAnalysis" : "juniorAnalysis";
}
