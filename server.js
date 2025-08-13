import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { buildResumeGraph } from "./resumeGraph/buildGraph.js";
import { parseResume } from "./utils/fileParser.js";
import multer from "multer";

dotenv.config();

const app = express();

// Configure CORS to accept requests from the specific origin
// The origin from the error message is: https://e8ff28cd6bae40a9bafa1a75d833d38d-94d4dca2fdbd4d508156316da.projects.builder.codes
const corsOptions = {
  origin: [
    "https://e8ff28cd6bae40a9bafa1a75d833d38d-94d4dca2fdbd4d508156316da.projects.builder.codes",
    "http://localhost:5173",
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
};

// Use the cors middleware with the specified options
app.use(cors(corsOptions));

// Optional: Add logging middleware to debug requests
app.use((req, res, next) => {
  console.log(
    `Received ${req.method} request for ${req.url} from origin ${req.headers.origin}`
  );
  next();
});

// Configure multer for file uploads
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: (req, file, cb) => {
    console.log("File type:", file.mimetype);
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

// app.use(express.json({ limit: "10mb" })); // Still needed for non-multipart JSON requests

app.post("/analyze-resume", upload.single("file"), async (req, res) => {
  try {
    console.log("Request headers:", req.headers);
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);
    const { filename } = req.body; // Get filename from form data
    const file = req.file; // Get file from multer

    if (!file || !filename) {
      return res.status(400).json({ error: "Missing file or filename" });
    }

    console.log("--Received file:", file.originalname);

    // Parse the resume from the file buffer
    const text = await parseResume(file.buffer, filename);
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
