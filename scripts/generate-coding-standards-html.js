/**
 * Coding Standards HTML Generator
 * Converts CODING_STANDARDS.md to CODING_STANDARDS.html
 */

const fs = require("fs");
const path = require("path");
const markdownIt = require("markdown-it");

const DOC_DIR = path.join(__dirname, "..", "docs");
const MD_INPUT = path.join(DOC_DIR, "CODING_STANDARDS.md");
const HTML_OUTPUT = path.join(DOC_DIR, "CODING_STANDARDS.html");

// Initialize markdown-it with plugins
const md = markdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
});

// Read markdown file
let markdownContent;
try {
  markdownContent = fs.readFileSync(MD_INPUT, "utf-8");
  console.log("Reading:", MD_INPUT);
} catch (error) {
  console.error("Error reading markdown file:", error.message);
  process.exit(1);
}

// Convert markdown to HTML
let htmlContent = md.render(markdownContent);

// Map of heading text (as it appears in HTML) to desired ID for sidebar navigation
const idMap = [
  ["1. Project Overview", "1-project-overview"],
  ["2. Naming Conventions", "2-naming-conventions"],
  ["3. File Structure", "3-file-structure"],
  ["4. Controller Standards", "4-controller-standards"],
  ["5. Service Standards", "5-service-standards"],
  ["6. Route Standards", "6-route-standards"],
  ["7. Validator Standards", "7-validator-standards"],
  ["8. Utility Standards", "8-utility-standards"],
  ["9. Middleware Standards", "9-middleware-standards"],
  ["10. Model Standards", "10-model-standards"],
  ["11. Error Handling", "11-error-handling"],
  ["12. Response Format", "12-response-format"],
  ["13. Permission Format", "13-permission-format"],
  ["14. Database Standards", "14-database-standards"],
  ["15. Caching Standards", "15-caching-standards"],
  ["16. Message Queue Standards", "16-message-queue-standards"],
  ["17. Documentation Standards", "17-documentation-standards"],
  ["18. Constants Standards", "18-constants-standards"],
  ["19. Migration & Seeding Standards", "19-migration--seeding-standards"],
  ["20. Environment Variables", "20-environment-variables"],
  ["21. Git & Deployment", "21-git--deployment"],
  ["22. Unit Testing Standards", "22-unit-testing-standards"],
  ["Quick Reference", "quick-reference"],
];

// Add anchor IDs to h2 headings for sidebar navigation
idMap.forEach(([headingText, id]) => {
  // Escape special regex characters
  let escapedHeading = headingText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Replace & with pattern that matches & or & (HTML entity)
  escapedHeading = escapedHeading.replace(/&/g, "&amp;?");
  // Match the entire h2 tag containing the heading text
  const h2Regex = new RegExp(
    `(<h2[^>]*>)\\s*${escapedHeading}\\s*(</h2>)`,
    "is",
  );

  if (h2Regex.test(htmlContent)) {
    htmlContent = htmlContent.replace(
      h2Regex,
      `<a id="${id}"></a>$1 ${headingText} $2`,
    );
  }
});

// Generate full HTML page
const generatedDate = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Coding Standards - Boilerplate PG MySQL</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #3498db;
            --primary-dark: #2980b9;
            --secondary: #2c3e50;
            --success: #2ecc71;
            --warning: #f39c12;
            --danger: #e74c3c;
            --text: #2c3e50;
            --text-light: #7f8c8d;
            --bg: #ffffff;
            --bg-light: #f8f9fa;
            --border: #e1e4e8;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.7; color: var(--text); background: var(--bg);
        }
        
        /* Sidebar */
        .sidebar {
            position: fixed; top: 0; left: 0; width: 280px; height: 100vh;
            background: var(--secondary); color: white; overflow-y: auto; z-index: 1000;
        }
        .sidebar-header { padding: 25px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .sidebar-header h2 { font-size: 16px; font-weight: 600; }
        .sidebar-header p { font-size: 12px; opacity: 0.7; margin-top: 5px; }
        .sidebar-nav { padding: 15px 0; }
        .sidebar-nav a {
            display: block; padding: 8px 20px; color: rgba(255,255,255,0.8);
            text-decoration: none; font-size: 13px; transition: all 0.2s;
        }
        .sidebar-nav a:hover, .sidebar-nav a.active {
            background: rgba(255,255,255,0.1); color: white; border-left: 3px solid var(--primary);
        }
        
        /* Main Content */
        .main-content {
            margin-left: 280px; padding: 40px 60px; max-width: 1000px;
        }
        .page-header { margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid var(--primary); }
        .page-header h1 { font-size: 2.5em; color: var(--secondary); margin-bottom: 10px; }
        .page-header .subtitle { font-size: 1.1em; color: var(--text-light); }
        .page-header .generated { font-size: 0.9em; color: var(--text-light); margin-top: 10px; }
        
        h2 {
            font-size: 1.8em; color: var(--secondary); margin-top: 50px; margin-bottom: 20px;
            padding-bottom: 10px; border-bottom: 2px solid var(--primary); scroll-margin-top: 80px;
        }
        h3 { font-size: 1.4em; color: #34495e; margin-top: 30px; margin-bottom: 15px; }
        h4 { font-size: 1.2em; color: #34495e; margin-top: 25px; margin-bottom: 10px; }
        p { margin-bottom: 15px; }
        
        table {
            width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.95em;
        }
        thead { background: linear-gradient(135deg, var(--primary), var(--primary-dark)); }
        th { color: white; padding: 12px 15px; text-align: left; font-weight: 600; }
        td { padding: 12px 15px; border-bottom: 1px solid var(--border); }
        tbody tr:nth-child(even) { background: var(--bg-light); }
        tbody tr:hover { background: #e8f4fd; }
        
        code {
            background: var(--bg-light); padding: 2px 8px; border-radius: 4px;
            font-family: 'JetBrains Mono', monospace; font-size: 0.9em;
            color: var(--danger); border: 1px solid var(--border);
        }
        pre {
            background: #1e1e2e; color: #cdd6f4; padding: 20px; border-radius: 8px;
            overflow-x: auto; margin: 20px 0;
        }
        pre code { background: none; padding: 0; color: inherit; border: none; }
        
        ul, ol { margin: 15px 0; padding-left: 30px; }
        li { margin-bottom: 8px; }
        a { color: var(--primary); text-decoration: none; }
        a:hover { text-decoration: underline; }
        
        .menu-toggle {
            display: none; position: fixed; top: 15px; left: 15px; z-index: 1100;
            background: var(--secondary); color: white; border: none;
            padding: 10px 15px; border-radius: 5px; cursor: pointer; font-size: 18px;
        }
        
        @media (max-width: 768px) {
            .sidebar { transform: translateX(-100%); }
            .sidebar.open { transform: translateX(0); }
            .main-content { margin-left: 0; padding: 60px 20px 40px; }
            .menu-toggle { display: block; }
        }
        @media print {
            .sidebar, .menu-toggle { display: none !important; }
            .main-content { margin-left: 0; }
        }
        
        .back-to-top {
            position: fixed; bottom: 30px; right: 30px; background: var(--primary);
            color: white; width: 45px; height: 45px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            text-decoration: none; opacity: 0; transition: opacity 0.3s;
            box-shadow: 0 4px 15px rgba(52,152,219,0.4);
        }
        .back-to-top.visible { opacity: 1; }
        
        .nav-link-docs {
            position: fixed; top: 20px; right: 20px; z-index: 1001;
            background: var(--primary); color: white; padding: 8px 16px;
            border-radius: 5px; text-decoration: none; font-size: 13px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .nav-link-docs:hover { background: var(--primary-dark); }
    </style>
</head>
<body>
    <a href="/documentation" class="nav-link-docs">← Main Docs</a>
    <button class="menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open')">Menu</button>
    
    <nav class="sidebar">
        <div class="sidebar-header">
            <h2>Coding Standards</h2>
            <p>Boilerplate PG MySQL v1.0</p>
        </div>
        <div class="sidebar-nav">
            <a href="#1-project-overview">1. Project Overview</a>
            <a href="#2-naming-conventions">2. Naming Conventions</a>
            <a href="#3-file-structure">3. File Structure</a>
            <a href="#4-controller-standards">4. Controller Standards</a>
            <a href="#5-service-standards">5. Service Standards</a>
            <a href="#6-route-standards">6. Route Standards</a>
            <a href="#7-validator-standards">7. Validator Standards</a>
            <a href="#8-utility-standards">8. Utility Standards</a>
            <a href="#9-middleware-standards">9. Middleware Standards</a>
            <a href="#10-model-standards">10. Model Standards</a>
            <a href="#11-error-handling">11. Error Handling</a>
            <a href="#12-response-format">12. Response Format</a>
            <a href="#13-permission-format">13. Permission Format</a>
            <a href="#14-database-standards">14. Database Standards</a>
            <a href="#15-caching-standards">15. Caching Standards</a>
            <a href="#16-message-queue-standards">16. Message Queue Standards</a>
            <a href="#17-documentation-standards">17. Documentation Standards</a>
            <a href="#18-constants-standards">18. Constants Standards</a>
            <a href="#19-migration--seeding-standards">19. Migration & Seeding Standards</a>
            <a href="#20-environment-variables">20. Environment Variables</a>
            <a href="#21-git--deployment">21. Git & Deployment</a>
            <a href="#22-unit-testing-standards">22. Unit Testing Standards</a>
            <div style="border-top: 1px solid rgba(255,255,255,0.1); margin: 10px 0;"></div>
            <a href="#quick-reference" style="opacity: 0.5; font-size: 12px;">Quick Reference</a>
        </div>
    </nav>
    
    <main class="main-content">
        <div class="page-header">
            <h1>Coding Standards & Guidelines</h1>
            <p class="subtitle">Comprehensive standards for the Boilerplate PG MySQL project</p>
            <p class="generated">Generated on ${generatedDate}</p>
        </div>

        ${htmlContent}

        <hr>
        <footer style="text-align:center;padding:30px 0;color:var(--text-light);font-size:14px;">
            <p>Generated on ${generatedDate}</p>
            <p>Boilerplate PG MySQL - Enterprise Multi-Tenant Express.js Boilerplate</p>
            <p style="margin-top:10px;"><a href="/documentation" style="color:var(--primary);">← Back to Main Documentation</a></p>
        </footer>
    </main>
    
    <a href="#" class="back-to-top" id="backToTop">Up</a>
    
    <script>
        const backToTop = document.getElementById('backToTop');
        window.addEventListener('scroll', () => {
            backToTop.classList.toggle('visible', window.scrollY > 300);
        });
        
        const sections = document.querySelectorAll('[id]');
        const navLinks = document.querySelectorAll('.sidebar-nav a');
        window.addEventListener('scroll', () => {
            let current = '';
            sections.forEach(section => {
                if (window.scrollY >= section.offsetTop - 100) {
                    current = section.getAttribute('id');
                }
            });
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('href') === '#' + current);
            });
        });
        
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    document.querySelector('.sidebar').classList.remove('open');
                }
            });
        });
    </script>
</body>
</html>`;

// Write HTML file
fs.writeFileSync(HTML_OUTPUT, fullHtml, "utf-8");

console.log("\nCoding Standards HTML generated!");
console.log(`   Path: ${HTML_OUTPUT}`);
console.log(`   Size: ${Math.round(fullHtml.length / 1024)} KB`);
console.log(`\nOpen in browser: ${HTML_OUTPUT}`);
