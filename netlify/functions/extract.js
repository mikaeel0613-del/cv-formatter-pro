const busboy = require("busboy");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

const CLAUDE_KEY = process.env.CLAUDE_API_KEY || "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";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  try {
    // Parse multipart upload
    const file = await parseUpload(event);
    if (!file) return json(400, { error: "No file uploaded" });

    // Extract text
    let text = "";
    const ext = (file.filename || "").split(".").pop().toLowerCase();

    if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer: file.data });
      text = result.value;
    } else if (ext === "pdf") {
      const result = await pdfParse(file.data);
      text = result.text;
    } else if (ext === "txt") {
      text = file.data.toString("utf-8");
    } else {
      return json(400, { error: "Unsupported format. Use .docx or .pdf" });
    }

    if (!text || text.trim().length < 10) return json(400, { error: "Could not extract text from file" });

    // Call Claude to parse
    const parsed = await aiParse(text);
    return json(200, { parsed });

  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

async function aiParse(text) {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Parse this CV into structured JSON. Return ONLY valid JSON, no markdown backticks, no explanation.

{
  "name": "full name without qualifications suffix",
  "position": "most recent job title",
  "qualifications": "short e.g. ACA (ICAEW), ACCA, BBA (1st Class)",
  "systems": "Xero\\nQuickBooks\\nSAGE\\nMicrosoft Office",
  "availability": "notice period if mentioned",
  "salary": "if mentioned, otherwise empty",
  "location": "city/area",
  "profile": "the profile/summary paragraphs combined",
  "experience": [
    {
      "dates": "Month Year – Month Year or Present",
      "employer": "Company Name (City)",
      "position": "Job Title",
      "responsibilities": "First responsibility\\nSecond responsibility\\nThird responsibility"
    }
  ],
  "qualificationsDetail": "Associate Chartered Accountant (ICAEW): Dec 2016\\nChartered Certified Accountant (ACCA): Feb 2012",
  "academics": "BBA (1st Class Merit) - University Name\\nHigher Secondary Certificate",
  "interests": "interests if mentioned"
}

RULES:
- Each employer MUST be a separate object in experience array
- Parse ALL roles, oldest to newest does not matter
- Responsibilities = individual bullet points joined by \\n
- Remove bullet characters from start of responsibilities
- Keep original wording
- systems should be one per line separated by \\n

CV:
${text.substring(0, 12000)}`
        }]
      })
    });

    const data = await resp.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    const raw = data.content.map(c => c.text || "").join("");
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("AI parse failed:", err);
    // Basic fallback
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    return { name: lines[0] || "", position: "", qualifications: "", systems: "", availability: "", salary: "", location: "", profile: "", experience: [{ dates: "", employer: "", position: "", responsibilities: "" }], qualificationsDetail: "", academics: "", interests: "" };
  }
}

function parseUpload(event) {
  return new Promise((resolve, reject) => {
    const bb = busboy({
      headers: { "content-type": event.headers["content-type"] || event.headers["Content-Type"] }
    });
    let fileData = null;
    bb.on("file", (name, stream, info) => {
      const chunks = [];
      stream.on("data", d => chunks.push(d));
      stream.on("end", () => { fileData = { data: Buffer.concat(chunks), filename: info.filename }; });
    });
    bb.on("finish", () => resolve(fileData));
    bb.on("error", reject);
    const body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body);
    bb.end(body);
  });
}

function json(code, data) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data) };
}
