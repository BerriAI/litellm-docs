const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const docId = "providers/bedrock_claude_platform";
const docPath = path.join(repoRoot, "docs", "providers", "bedrock_claude_platform.md");
const bedrockPath = path.join(repoRoot, "docs", "providers", "bedrock.md");
const sidebars = require(path.join(repoRoot, "sidebars.js"));

function flattenSidebarItems(items) {
  return items.flatMap((item) => {
    if (typeof item === "string") {
      return [item];
    }

    if (item.type === "doc") {
      return [item.id];
    }

    if (Array.isArray(item.items)) {
      return flattenSidebarItems(item.items);
    }

    return [];
  });
}

assert.ok(fs.existsSync(docPath), `${docId} page should exist`);

const allSidebarDocIds = flattenSidebarItems(sidebars.tutorialSidebar);
assert.ok(
  allSidebarDocIds.includes(docId),
  `${docId} should be listed in tutorialSidebar`
);

const bedrockDoc = fs.readFileSync(bedrockPath, "utf8");
assert.match(
  bedrockDoc,
  /\[`bedrock\/claude_platform\/`\]\(\.\/bedrock_claude_platform\.md\)/,
  "Bedrock overview should link to the Claude Platform page"
);

const claudePlatformDoc = fs.readFileSync(docPath, "utf8");
assert.match(
  claudePlatformDoc,
  /# Claude Platform on AWS/,
  "Claude Platform page should include the expected title"
);
assert.match(
  claudePlatformDoc,
  /bedrock\/claude_platform\/<model>/,
  "Claude Platform page should document the route shape"
);
