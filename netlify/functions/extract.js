const busboy = require("busboy");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  try {
    const file = await parseUpload(event);
    if (!file) return json(400, { error: "No file uploaded" });

    let text = "";
    const ext = (file.filename || "").split(".").pop().toLowerCase();

    if (ext === "docx") {
      text = (await mammoth.extractRawText({ buffer: file.data })).value;
    } else if (ext === "pdf") {
      text = (await pdfParse(file.data)).text;
    } else if (ext === "txt") {
      text = file.data.toString("utf-8");
    } else {
      return json(400, { error: "Unsupported format. Use .docx or .pdf" });
    }

    if (!text || text.trim().length < 10) return json(400, { error: "Could not extract text from file" });

    const KEY = process.env.CLAUDE_API_KEY;
    if (!KEY) return json(500, { error: "API key not configured" });

    const parsed = await aiParse(text, KEY);
    return json(200, { parsed });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};

async function aiParse(text, KEY) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: "You are a CV parser. Your job is to extract structured data from a CV. Return ONLY valid JSON. No backticks. No explanation.\n\nOutput this exact JSON structure:\n{\"name\":\"\",\"position\":\"most recent job title\",\"qualifications\":\"short summary\",\"systems\":\"one per line separated by newlines\",\"availability\":\"\",\"salary\":\"\",\"location\":\"\",\"profile\":\"summary paragraphs\",\"experience\":[{\"dates\":\"\",\"employer\":\"Company (City)\",\"position\":\"Job Title\",\"responsibilities\":\"bullet1\\nbullet2\\nbullet3\"}],\"qualificationsDetail\":\"qual1\\nqual2\",\"academics\":\"degree1\\ndegree2\",\"interests\":\"\"}\n\nCRITICAL RULES:\n1. EVERY separate employer MUST be its own object in the experience array. If someone worked at 4 companies, there must be 4 objects.\n2. Parse ALL roles from the CV. Do not skip any.\n3. Each responsibility is a separate line joined by \\n\n4. Remove bullet characters from responsibilities\n5. Keep the original wording from the CV\n6. Systems should be one per line joined by \\n\n\nCV TEXT:\n" + text.substring(0, 12000)
      }]
    })
  });

  const data = await resp.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  const raw = data.content.map(function(c) { return c.text || ""; }).join("");
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

function parseUpload(event) {
  return new Promise(function(resolve, reject) {
    const bb = busboy({ headers: { "content-type": event.headers["content-type"] || event.headers["Content-Type"] } });
    let fileData = null;
    bb.on("file", function(name, stream, info) {
      const chunks = [];
      stream.on("data", function(d) { chunks.push(d); });
      stream.on("end", function() { fileData = { data: Buffer.concat(chunks), filename: info.filename }; });
    });
    bb.on("finish", function() { resolve(fileData); });
    bb.on("error", reject);
    const body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(event.body);
    bb.end(body);
  });
}

function json(code, data) {
  return { statusCode: code, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data) };
}
