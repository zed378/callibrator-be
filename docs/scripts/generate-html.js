/**
 * Generate HTML from TABLE_PERMISSIONS.md
 *
 * This script converts TABLE_PERMISSIONS.md to a styled HTML document.
 * It replaces ASCII diagram references with SVG image references.
 *
 * Usage:
 *   node generate-html.js                          # Generate to stdout
 *   node generate-html.js -o output.html           # Generate to file
 *   node generate-html.js --preview                # Generate and open in browser
 *
 * Requirements:
 *   - TABLE_PERMISSIONS.md must exist in the same directory
 *   - SVG assets must exist in the illustrations/ directory
 */

const fs = require("fs");
const path = require("path");

// Parse arguments
const args = process.argv.slice(2);
const outputArg = args.indexOf("-o");
const outputFile = outputArg >= 0 ? args[outputArg + 1] : null;
const preview = args.includes("--preview");

// Paths
const docsDir = path.join(__dirname, "..");
const markdownPath = path.join(docsDir, "TABLE_PERMISSIONS.md");
const illustrationsDir = path.join(docsDir, "illustrations");

// Verify SVG assets exist
const svgFiles = [
  "12-table-permissions-architecture.svg",
  "13-table-permissions-flow-diagram.svg",
  "14-table-permissions-erd.svg",
];

svgFiles.forEach((file) => {
  const svgPath = path.join(illustrationsDir, file);
  if (!fs.existsSync(svgPath)) {
    console.warn(`Warning: SVG asset not found: ${file}`);
  }
});

// Read markdown
let markdown;
try {
  markdown = fs.readFileSync(markdownPath, "utf8");
} catch (err) {
  console.error(`Error: Cannot read ${markdownPath}`);
  process.exit(1);
}

// Step 1: Identify and replace ASCII diagrams with SVG placeholders
// We'll mark ASCII diagram blocks for replacement

// Architecture diagram (from "```" before AUTHENTICATION to closing "```")
const architecturePattern =
  /### Architecture\s*\n\s*```(\r?\n)(?:[\s\S]*?)?AUTHENTICATION[\s\S]*?```/g;

if (architecturePattern.test(markdown)) {
  markdown = markdown.replace(architecturePattern, () => {
    return `### Architecture

<div class="diagram">
  <img src="illustrations/12-table-permissions-architecture.svg" alt="Table Permissions Architecture" class="diagram-image">
</div>`;
  });
}

// Flow diagram
const flowPattern = /### Flow Diagram\s*\n\s*```\s*\n[\s\S]*?```/g;

if (flowPattern.test(markdown)) {
  markdown = markdown.replace(flowPattern, () => {
    return `### Flow Diagram

<div class="diagram">
  <img src="illustrations/13-table-permissions-flow-diagram.svg" alt="Permission Check Flow" class="diagram-image">
</div>`;
  });
}

// ERD
const erdPattern =
  /### Entity Relationship Diagram\s*\n\s*```\s*\n[\s\S]*?```/g;

if (erdPattern.test(markdown)) {
  markdown = markdown.replace(erdPattern, () => {
    return `### Entity Relationship Diagram

<div class="diagram">
  <img src="illustrations/14-table-permissions-erd.svg" alt="Entity Relationship Diagram" class="diagram-image">
</div>`;
  });
}

// Step 2: Convert markdown to HTML
let html = convertMarkdownToHTML(markdown);

// Step 3: Generate full HTML document
const fullHTML = generateHTMLDocument(html);

// Output
if (outputFile) {
  const outputPath = path.resolve(outputFile);
  fs.writeFileSync(outputPath, fullHTML);
  console.log(`Generated HTML: ${outputPath}`);
} else {
  console.log(fullHTML);
}

if (preview) {
  const tmpFile = path.join(require("os").tmpdir(), "table-permissions.html");
  fs.writeFileSync(tmpFile, fullHTML);
  console.log(`Preview file: ${tmpFile}`);
  const { exec } = require("child_process");
  exec(`open "${tmpFile}" || xdg-open "${tmpFile}"`);
}

// ============================================================
// MARKDOWN CONVERTER
// ============================================================

function convertMarkdownToHTML(md) {
  const lines = md.split("\n");
  let result = "";
  let inTable = false;
  let tableRows = "";
  let inCodeBlock = false;
  let codeContent = "";
  let codeLang = "";
  let inList = false;
  let listType = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        result += `<pre><code class="language-${codeLang}">${escapeHtml(codeContent.trim())}</code></pre>\n`;
        inCodeBlock = false;
        codeContent = "";
        codeLang = "";
      } else {
        if (inList) {
          result += listType === "ul" ? "</ul>\n" : "</ol>\n";
          inList = false;
        }
        inCodeBlock = true;
        const langMatch = line.match(/^```(\w+)/);
        codeLang = langMatch ? langMatch[1] : "";
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    // Headers
    if (line.startsWith("# ")) {
      if (inList) {
        result += listType === "ul" ? "</ul>\n" : "</ol>\n";
        inList = false;
      }
      result += `<h1>${line.slice(2)}</h1>\n`;
      continue;
    }

    if (line.startsWith("## ")) {
      if (inList) {
        result += listType === "ul" ? "</ul>\n" : "</ol>\n";
        inList = false;
      }
      result += `<h2>${line.slice(3)}</h2>\n`;
      continue;
    }

    if (line.startsWith("### ")) {
      if (inList) {
        result += listType === "ul" ? "</ul>\n" : "</ol>\n";
        inList = false;
      }
      result += `<h3>${line.slice(4)}</h3>\n`;
      continue;
    }

    // Horizontal rules
    if (/^---+$/.test(line.trim())) {
      if (inList) {
        result += listType === "ul" ? "</ul>\n" : "</ol>\n";
        inList = false;
      }
      result += "<hr>\n";
      continue;
    }

    // Tables
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = "";
        isHeaderRow = true;
      }

      const cells = line
        .split("|")
        .filter((c) => c.trim() !== "")
        .map((c) => c.trim());

      // Skip separator rows (cells contain only dashes, spaces, colons)
      const isSeparatorRow =
        cells.length > 0 && cells.every((cell) => /^[\s\-:]+$/.test(cell));

      if (isSeparatorRow) {
        continue;
      }

      let rowHtml = "<tr>";
      cells.forEach((cell) => {
        const content = convertInlineMarkdown(cell);
        if (isHeaderRow) {
          rowHtml += "<th>" + content + "</th>";
        } else {
          rowHtml += "<td>" + content + "</td>";
        }
      });
      rowHtml += "</tr>";

      if (isHeaderRow) {
        tableRows = "<thead>" + rowHtml + "</thead><tbody>";
        isHeaderRow = false;
      } else {
        tableRows += rowHtml;
      }
      continue;
    } else if (inTable) {
      if (!isHeaderRow && tableRows) {
        tableRows += "</tbody>";
      }
      result += "<table>\n" + tableRows + "</table>\n";
      inTable = false;
      tableRows = "";
      isHeaderRow = true;
    }

    // Lists
    if (/^\s*-\s/.test(line) || /^\s*\*\s/.test(line)) {
      if (!inList) {
        inList = true;
        listType = "ul";
        result += "<ul>\n";
      }
      const content = line.replace(/^\s*[-*]\s+/, "");
      result += `<li>${convertInlineMarkdown(content)}</li>\n`;
      continue;
    }

    // Numbered lists
    if (/^\s*\d+\.\s/.test(line)) {
      if (!inList || listType !== "ol") {
        if (inList) {
          result += listType === "ul" ? "</ul>\n" : "</ol>\n";
        }
        inList = true;
        listType = "ol";
        result += "<ol>\n";
      }
      const content = line.replace(/^\s*\d+\.\s+/, "");
      result += `<li>${convertInlineMarkdown(content)}</li>\n`;
      continue;
    }

    // Close list if we're no longer in one
    if (inList && line.trim() === "") {
      result += listType === "ul" ? "</ul>\n" : "</ol>\n";
      inList = false;
    }

    // Empty lines
    if (line.trim() === "") {
      continue;
    }

    // Regular paragraphs
    if (inList) {
      result += listType === "ul" ? "</ul>\n" : "</ol>\n";
      inList = false;
    }
    result += `<p>${convertInlineMarkdown(line)}</p>\n`;
  }

  // Close any open tags
  if (inCodeBlock) {
    result += `<pre><code>${escapeHtml(codeContent.trim())}</code></pre>\n`;
  }
  if (inTable) {
    result += `<table>\n${tableRows}</table>\n`;
  }
  if (inList) {
    result += listType === "ul" ? "</ul>\n" : "</ol>\n";
  }

  return result;
}

function convertInlineMarkdown(text) {
  // Process inline code first (to preserve raw content inside backticks)
  const codeReplacements = [];
  text = text.replace(/`([^`]+)`/g, (match, content) => {
    const placeholder = `%%CODE${codeReplacements.length}%%`;
    codeReplacements.push(`<code>${content}</code>`);
    return placeholder;
  });

  // Escape HTML
  text = escapeHtml(text);

  // Restore code tags
  text = text.replace(
    /%%CODE(\d)%%/g,
    (_, idx) => codeReplacements[parseInt(idx)],
  );

  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");

  return text;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;")
    .replace(/'/g, "&" + "#39;");
}

// ============================================================
// HTML DOCUMENT TEMPLATE
// ============================================================

function generateHTMLDocument(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Table Permissions System Documentation</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #1e293b;
      --border: #e2e8f0;
      --code-bg: #f1f5f9;
      --accent: #6366f1;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --text: #e2e8f0;
        --border: #334155;
        --code-bg: #1e293b;
        --accent: #818cf8;
      }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1 { font-size: 2rem; margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--border); }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; padding-bottom: 0.3rem; border-bottom: 1px solid var(--border); }
    h3 { font-size: 1.2rem; margin: 1.5rem 0 0.5rem; }
    p { margin: 1rem 0; }
    pre {
      background: var(--code-bg);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
    }
    code {
      background: var(--code-bg);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: 0.9em;
    }
    pre code { background: none; padding: 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    th, td {
      padding: 0.75rem;
      border: 1px solid var(--border);
      text-align: left;
    }
    th { background: var(--code-bg); font-weight: 600; }
    hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
    .diagram {
      text-align: center;
      margin: 2rem 0;
      padding: 1rem;
      background: var(--code-bg);
      border-radius: 8px;
    }
    .diagram-image {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
    }
    ul, ol { margin: 1rem 0; padding-left: 2rem; }
    li { margin: 0.5rem 0; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}
