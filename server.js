import express from "express";
import dotenv from "dotenv";
import cors from "cors";
// import { buildResumeGraph } from "./resumeGraph.js";
import { buildResumeGraph } from "./resumeGraph/buildGraph.js";
import { parseBase64Resume } from "./utils/fileParser.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

// Configure CORS to accept requests from the specific origin
// The origin from the error message is: https://e8ff28cd6bae40a9bafa1a75d833d38d-94d4dca2fdbd4d508156316da.projects.builder.codes
const corsOptions = {
  origin:
    "https://e8ff28cd6bae40a9bafa1a75d833d38d-94d4dca2fdbd4d508156316da.projects.builder.codes",
};

// Use the cors middleware with the specified options
app.use(cors(corsOptions));

app.post("/analyze-resume", async (req, res) => {
  try {
    const { fileBase64, filename } = req.body;

    if (!fileBase64 || !filename) {
      return res.status(400).json({ error: "Missing base64 file or filename" });
    }
    console.log("--Parsed resume fileBase64:", fileBase64);

    const text = await parseBase64Resume(fileBase64, filename);
    console.log("--Parsed resume text:", text);
    const graph = await buildResumeGraph();
    const result = await graph.invoke({ resumeText: text });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to analyze resume" });
  }
});

app.listen(3000, () => {
  console.log("✅ Resume analyzer running at http://localhost:3000");
});
