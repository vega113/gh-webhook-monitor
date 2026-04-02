import { execFileSync } from "node:child_process";

function toggleAutoMerge(repo, prNumber, enabled) {
  if (enabled) {
    execFileSync(
      "gh",
      ["pr", "merge", String(prNumber), "--repo", repo, "--auto", "--merge"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
    );
    return {
      repo,
      prNumber,
      autoMergeEnabled: true,
      mergeMethod: "merge",
    };
  }

  execFileSync(
    "gh",
    ["pr", "merge", String(prNumber), "--repo", repo, "--disable-auto"],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
  );
  return {
    repo,
    prNumber,
    autoMergeEnabled: false,
    mergeMethod: null,
  };
}

export { toggleAutoMerge };
