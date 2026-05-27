/* eslint-disable no-restricted-syntax, no-continue */
const TriggerMatcher = (
  messageBody: string,
  triggerKeywords: string | null
): boolean => {
  if (!triggerKeywords) return false;
  if (!messageBody) return false;

  const lowerBody = messageBody.toLowerCase().trim();

  const keywords = triggerKeywords
    .split("\n")
    .map(k => k.trim())
    .filter(Boolean);

  for (const kw of keywords) {
    const lowerKw = kw.toLowerCase().trim();
    if (!lowerKw) continue;
    if (lowerBody.includes(lowerKw)) return true;
  }

  return false;
};

export default TriggerMatcher;
