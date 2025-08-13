import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function parseBase64Resume(base64String, filename) {
  const fileType = filename.toLowerCase().split(".").pop();
  const buffer = Buffer.from(base64String, "base64");

  if (fileType === "pdf") {
    const result = await pdfParse(buffer);
    console.log("Parsed PDF text:", result.text);
    return result.text;
  } else if (fileType === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    throw new Error("Unsupported file type. Only PDF and DOCX are supported.");
  }
}

export const parseResume = async (fileBuffer, filename) => {
  try {
    if (!filename.toLowerCase().endsWith(".pdf")) {
      throw new Error("Only PDF files are supported");
    }

    // Parse the PDF buffer to extract text
    const data = await pdfParse(fileBuffer);
    return data.text;
  } catch (error) {
    console.error("Error parsing resume:", error);
    throw new Error("Failed to parse resume file");
  }
};
