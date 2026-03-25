import { getConfig, DEFAULT_PROMPT_TEMPLATES } from "./config.js";

function renderPrompt(templateKey, vars) {
  const config = getConfig();
  let tpl =
    config.promptTemplates[templateKey] ||
    DEFAULT_PROMPT_TEMPLATES[templateKey] ||
    "";
  for (const [k, v] of Object.entries(vars)) {
    tpl = tpl.replaceAll(`{{${k}}}`, String(v));
  }
  return tpl;
}

export { renderPrompt };
