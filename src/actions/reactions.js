import { spawn } from "node:child_process";

function reactToIssue(repo, issueNumber, reaction) {
  const child = spawn(
    "gh",
    [
      "api",
      `repos/${repo}/issues/${issueNumber}/reactions`,
      "--method",
      "POST",
      "--field",
      `content=${reaction}`,
    ],
    {
      stdio: ["ignore", "ignore", "ignore"],
    }
  );
  child.on("error", () => {});
}

function reactToComment(repo, commentId, reaction) {
  const child = spawn(
    "gh",
    [
      "api",
      `repos/${repo}/issues/comments/${commentId}/reactions`,
      "--method",
      "POST",
      "--field",
      `content=${reaction}`,
    ],
    {
      stdio: ["ignore", "ignore", "ignore"],
    }
  );
  child.on("error", () => {});
}

export { reactToIssue, reactToComment };
