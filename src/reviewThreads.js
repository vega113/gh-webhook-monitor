import { execSync } from "node:child_process";

function defaultRunGraphQL(query) {
  const body = JSON.stringify({ query });
  const output = execSync(`gh api graphql`, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
    input: body,
  });
  return JSON.parse(output);
}

function buildReviewThreadsQuery(repo, prNumber) {
  const [owner, name] = repo.split("/");
  return `
    query {
      repository(owner: "${owner}", name: "${name}") {
        pullRequest(number: ${prNumber}) {
          reviewThreads(first: 100, isResolved: false) {
            nodes {
              id
              isResolved
              comments(first: 100) {
                nodes {
                  author {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
}

function getThreadAuthorLogins(thread) {
  return (thread?.comments?.nodes || [])
    .map((comment) => comment?.author?.login || "")
    .filter(Boolean);
}

function matchesBotLogin(login, botNames = []) {
  const normalizedLogin = String(login || "").toLowerCase();
  if (!normalizedLogin) return false;
  return botNames.some((botName) =>
    normalizedLogin.includes(String(botName || "").toLowerCase())
  );
}

function normalizeReviewThread(thread, botNames = []) {
  const authorLogins = getThreadAuthorLogins(thread);
  const matchedBotAuthor =
    authorLogins.find((login) => matchesBotLogin(login, botNames)) || "";

  return {
    id: thread.id,
    isResolved: Boolean(thread.isResolved),
    authorLogin: matchedBotAuthor || authorLogins[0] || "",
    authorLogins,
  };
}

function fetchReviewThreads(repo, prNumber, options = {}) {
  const runGraphQL = options.runGraphQL || defaultRunGraphQL;
  const botNames = options.botNames || [];
  const result = runGraphQL(buildReviewThreadsQuery(repo, prNumber));

  if (result.errors) {
    throw new Error(
      `GraphQL error: ${result.errors.map((error) => error.message).join(", ")}`
    );
  }

  const threads =
    result.data?.repository?.pullRequest?.reviewThreads?.nodes || [];
  return threads.map((thread) => normalizeReviewThread(thread, botNames));
}

export {
  buildReviewThreadsQuery,
  defaultRunGraphQL,
  fetchReviewThreads,
  getThreadAuthorLogins,
  matchesBotLogin,
  normalizeReviewThread,
};
