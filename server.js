import express from "express";
import dotenv from "dotenv";
import { buildResumeGraph } from "./resumeGraph.js";
import { parseBase64Resume } from "./utils/fileParser.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

app.post("/analyze-resume", async (req, res) => {
  try {
    const { fileBase64, filename } = req.body;

    if (!fileBase64 || !filename) {
      return res.status(400).json({ error: "Missing base64 file or filename" });
    }

    const text = await parseBase64Resume(fileBase64, filename);
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
