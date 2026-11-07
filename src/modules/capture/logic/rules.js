/** Rule matching a raw notification, if any. */
export const ruleFor = (rules, raw) =>
  rules.find((r) => r.fromPackage === raw.packageName && `${raw.title} ${raw.text}`.toLowerCase().includes(String(r.keyword).toLowerCase()));
