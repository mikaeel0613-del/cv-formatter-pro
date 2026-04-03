const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, Header, Footer, AlignmentType, BorderStyle, WidthType,
  TabStopType, TabStopPosition, LevelFormat
} = require("docx");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" }, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  try {
    const d = JSON.parse(event.body);
    const color = String(d.brandColor || "C00000").replace("#", "");
    const PW = 11906, PH = 16838, M = 1440, CW = PW - 2 * M;
    const nb = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const nbs = { top: nb, bottom: nb, left: nb, right: nb };

    // Helpers
    const lbl = (t) => new Paragraph({ spacing: { before: 120, after: 0 }, children: [new TextRun({ text: String(t || ""), font: "Arial", size: 20, bold: true })] });
    const val = (t) => new Paragraph({ spacing: { before: 0, after: 60 }, children: [new TextRun({ text: String(t || ""), font: "Arial", size: 20 })] });
    const emp = () => new Paragraph({ spacing: { before: 0, after: 0 }, children: [] });
    const bul = (t, r) => new Paragraph({ numbering: { reference: r, level: 0 }, spacing: { before: 40, after: 40 }, children: [new TextRun({ text: String(t || ""), font: "Arial", size: 20 })] });

    function expTbl(dates, employer, position) {
      const cm = { top: 40, bottom: 40, left: 80, right: 80 }, lW = 2200, vW = CW - lW;
      const rw = (l, v) => new TableRow({ children: [
        new TableCell({ width: { size: lW, type: WidthType.DXA }, borders: nbs, margins: cm, children: [new Paragraph({ children: [new TextRun({ text: String(l), font: "Arial", size: 20, bold: true })] })] }),
        new TableCell({ width: { size: vW, type: WidthType.DXA }, borders: nbs, margins: cm, children: [new Paragraph({ children: [new TextRun({ text: String(v || ""), font: "Arial", size: 20, bold: true })] })] })
      ] });
      return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [lW, vW], rows: [
        rw("Date:", dates), rw("Employer:", employer), rw("Position:", position),
        new TableRow({ children: [
          new TableCell({ width: { size: lW, type: WidthType.DXA }, borders: nbs, margins: cm, children: [new Paragraph({ children: [new TextRun({ text: "Responsibilities:", font: "Arial", size: 20, bold: true })] })] }),
          new TableCell({ width: { size: vW, type: WidthType.DXA }, borders: nbs, margins: cm, children: [new Paragraph({ children: [] })] })
        ] })
      ] });
    }

    // Logo
    let logoChildren = [];
    if (d.logoBase64) {
      try {
        const logoData = Buffer.from(d.logoBase64.split(",").pop(), "base64");
        const logoType = d.logoBase64.includes("image/png") ? "png" : "jpg";
        logoChildren = [
          new TextRun({ text: "\t", font: "Arial", size: 16 }),
          new ImageRun({ type: logoType, data: logoData, transformation: { width: 180, height: 45 }, altText: { title: "Logo", description: "Logo", name: "logo" } })
        ];
      } catch (e) { console.error("Logo error:", e); }
    }

    // Header
    const header = new Header({ children: [
      new Paragraph({ spacing: { before: 0, after: 0 }, tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }], children: [
        new TextRun({ text: "This profile is presented by:", font: "Arial", size: 16, color: "808080" }),
        ...logoChildren
      ] }),
      new Paragraph({ children: [new TextRun({ text: String(d.consultantName || ""), font: "Arial", size: 16, color: color })] }),
      new Paragraph({ children: [new TextRun({ text: String(d.consultantTitle || ""), font: "Arial", size: 16, color: color })] }),
      new Paragraph({ children: [new TextRun({ text: "T: " + String(d.consultantPhone || ""), font: "Arial", size: 16, color: color })] }),
      new Paragraph({ children: [new TextRun({ text: "E: " + String(d.consultantEmail || ""), font: "Arial", size: 16, color: color })] }),
    ] });

    // Footer
    const fItems = [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(d.company || ""), font: "Arial", size: 14, color: color })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(d.companyAddress || ""), font: "Arial", size: 14, color: color })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Tel: " + String(d.consultantPhone || "") + " - Website: " + String(d.companyWebsite || ""), font: "Arial", size: 14, color: color })] }),
    ];
    if (d.companyReg) fItems.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(d.companyReg), font: "Arial", size: 14, color: color })] }));
    fItems.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "By accepting this candidate for interview you are deemed to be accepting " + String(d.company || "") + "\u2019s Terms of Business", font: "Arial", size: 14, color: color })] }));
    const footer = new Footer({ children: fItems });

    // Page 1
    const sysItems = String(d.systems || "").split("\n").map(s => s.trim()).filter(Boolean);
    const page1 = [
      new Paragraph({ spacing: { before: 0, after: 200 }, children: [new TextRun({ text: "Candidate Profile", font: "Arial", size: 32, bold: true, color: color })] }),
      lbl("Name"), val(d.name), emp(),
      lbl("Position Required"), val(d.position), emp(),
      lbl("Qualifications"), val(d.qualifications), emp(),
      lbl("Systems"),
      ...sysItems.map(s => bul(s, "sb")),
      emp(), lbl("Availability"), val(d.availability), emp(),
      lbl("Salary Sought"), val(d.salary), emp(),
      lbl("Location"), val(d.location),
    ];

    // Page 2
    const page2 = [
      new Paragraph({ spacing: { before: 0, after: 200 }, children: [new TextRun({ text: "Candidate\u2019s CV", font: "Arial", size: 32, bold: true, color: color })] }),
      lbl("Profile"),
      new Paragraph({ spacing: { before: 60, after: 200 }, children: [new TextRun({ text: String(d.profile || ""), font: "Arial", size: 20 })] }),
      new Paragraph({ spacing: { before: 100, after: 120 }, children: [new TextRun({ text: "Professional Experience", font: "Arial", size: 20, bold: true })] }),
    ];

    (d.experience || []).forEach(e => {
      if (!e.employer && !e.responsibilities) return;
      if (e.employer) { page2.push(expTbl(e.dates, e.employer, e.position)); page2.push(emp()); }
      String(e.responsibilities || "").split("\n").map(r => r.replace(/^[-•*▪○◦]\s*/, "").trim()).filter(Boolean).forEach(l => page2.push(bul(l, "eb")));
      page2.push(emp());
    });

    if (d.qualificationsDetail) {
      page2.push(new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: "Professional Qualifications", font: "Arial", size: 20, bold: true })] }));
      String(d.qualificationsDetail).split("\n").filter(Boolean).forEach(q => page2.push(bul(q.replace(/^[-•*]\s*/, ""), "qb")));
      page2.push(emp());
    }
    if (d.academics) {
      page2.push(new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: "Academics", font: "Arial", size: 20, bold: true })] }));
      String(d.academics).split("\n").filter(Boolean).forEach(a => page2.push(bul(a.replace(/^[-•*]\s*/, ""), "ab")));
      page2.push(emp());
    }
    if (d.interests) {
      page2.push(new Paragraph({ spacing: { before: 200, after: 60 }, children: [
        new TextRun({ text: "Interests: ", font: "Arial", size: 20, bold: true }),
        new TextRun({ text: String(d.interests), font: "Arial", size: 20 }),
      ] }));
    }

    const bc = (r) => ({ reference: r, levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] });

    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
      numbering: { config: [bc("sb"), bc("eb"), bc("qb"), bc("ab")] },
      sections: [
        { properties: { page: { size: { width: PW, height: PH }, margin: { top: 2400, bottom: 2000, left: M, right: M } } }, headers: { default: header }, footers: { default: footer }, children: page1 },
        { properties: { page: { size: { width: PW, height: PH }, margin: { top: 2400, bottom: 2000, left: M, right: M } } }, children: page2 },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const base64 = buffer.toString("base64");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": "attachment; filename=CV.docx",
        "Access-Control-Allow-Origin": "*",
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error("Generate error:", err);
    return { statusCode: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: err.message }) };
  }
};
