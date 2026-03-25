const express = require("express");
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const libre = require("libreoffice-convert");
const crypto = require("crypto");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const libreConvert = libre.convertAsync
  ? libre.convertAsync.bind(libre)
  : (buf, ext, filter) =>
      new Promise((resolve, reject) =>
        libre.convert(buf, ext, filter, (err, result) =>
          err ? reject(err) : resolve(result)
        )
      );

const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error("FATAL ERROR: ACCESS_TOKEN environment variable is not set.");
  process.exit(1);
}
console.log("[auth] ACCESS_TOKEN loaded (set)");

const app = express();

app.use(helmet());

app.use(express.json({ limit: "500kb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later."
});
app.use(limiter);

app.use((req, res, next) => {
  console.log(`[request] ${req.method} ${req.path} | token: ${req.query.token ? "(present)" : "(none)"}`);
  next();
});

app.get("/index.html", (req, res) => {
  console.log("[auth] Blocked direct /index.html access");
  return res.status(401).send("Unauthorized");
});

app.use(express.static("public", { index: false }));

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

app.get("/", (req, res) => {
  console.log("[auth] GET / | token query param:", req.query.token ? "(present)" : "(none)");
  
  if (!safeCompare(req.query.token, ACCESS_TOKEN)) {
    console.log("[auth] Rejected: token mismatch or missing");
    return res.status(401).send("Unauthorized");
  }
  
  console.log("[auth] Accepted: serving index.html");
  const html = fs.readFileSync(path.join("public", "index.html"), "utf8");
  const injected = html.replace(
    "</body>",
    `<script>window.__TOKEN__ = ${JSON.stringify(ACCESS_TOKEN)};</script>\n</body>`
  );
  res.send(injected);
});

function formatName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatCPF(cpf) {
  if (!cpf) return "";
  cpf = cpf.replace(/\D/g, ""); // remove non-digits
  cpf = cpf.padStart(11, "0"); // left pad

  return cpf.replace(
    /(\d{3})(\d{3})(\d{3})(\d{2})/,
    "$1.$2.$3-$4"
  );
}

function formatCEP(cep) {
  if (!cep) return "";
  cep = cep.replace(/\D/g, "").padStart(8, "0");
  return cep.replace(/(\d{5})(\d{3})/, "$1-$2");
}

function getDocumentDate() {
  const now = new Date();
  // Last day of previous month
  const d = new Date(now.getFullYear(), now.getMonth(), 0);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function getExpireDate(short = false) {
  const now = new Date();
  const dd = "15";
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  return short ? `${dd}/${mm}/${String(yyyy).slice(2)}` : `${dd}/${mm}/${yyyy}`;
}

app.post("/generate", async (req, res) => {
  if (!safeCompare(req.body.token, ACCESS_TOKEN)) {
    return res.status(401).send("Unauthorized");
  }

  try {
    let { fullName, cpf, rua, numero, complemento, bairro, cidade, cep } = req.body;

    console.log("[generate] Processing document generation request");

    fullName = formatName(fullName);
    cpf = formatCPF(cpf);
    cep = formatCEP(cep);

    const addressParts = [
      rua ? formatName(rua) : null,
      numero,
      complemento ? formatName(complemento) : null,
      bairro ? formatName(bairro) : null,
      cidade ? formatName(cidade) : null,
    ].filter(Boolean);
    const address = addressParts.join(", ");

    const documentDate = getDocumentDate();
    const expireDate = getExpireDate(false);
    const shortExpireDate = getExpireDate(true);
    const now = new Date();
    const cyear = String(now.getFullYear());
    const cmonth = String(now.getMonth() + 1);

    const templatePath = path.resolve("template.odt");
    if (!fs.existsSync(templatePath)) {
      console.error("[generate] template.odt not found at:", templatePath);
      return res.status(500).send("Template file not found");
    }

    const content = fs.readFileSync(templatePath);

    const data = {
      FULL_NAME_HERE: fullName,
      CPF_HERE: cpf,
      ADDRESS_HERE: address,
      CEP_HERE: cep,
      DOCUMENT_DATE: documentDate,
      EXPIRE_DATE: expireDate,
      SHORT_EXPIRE_DATE: shortExpireDate,
      CYEAR: cyear,
      CMONTH: cmonth,
    };

    const zip = new PizZip(content);
    let xml = zip.file("content.xml").asText();

    for (const [key, value] of Object.entries(data)) {
      const escaped = value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
      xml = xml.split(`{${key}}`).join(escaped);
    }

    const unreplaced = Object.keys(data).filter(k => xml.includes(`{${k}}`));
    if (unreplaced.length > 0) {
      console.warn("[generate] WARNING: These placeholders were NOT replaced:", unreplaced);
    }

    zip.file("content.xml", xml);
    const buf = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });

    console.log("[generate] Converting ODT to PDF via LibreOffice...");
    
    const conversionPromise = libreConvert(buf, ".pdf", undefined);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("LibreOffice conversion timed out")), 15000)
    );
    const pdfBuf = await Promise.race([conversionPromise, timeoutPromise]);

    if (!pdfBuf || pdfBuf.length === 0) {
      console.error("[generate] PDF buffer is empty after conversion");
      return res.status(500).send("PDF conversion produced empty output");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
    res.send(pdfBuf);
    console.log("[generate] PDF successfully generated and sent");

  } catch (error) {
    console.error("[generate] Error:", error.message || error);
    res.status(500).send("Error generating document");
  }
});

app.listen(3100, () => {
  console.log("Server running on http://localhost:3100");
});