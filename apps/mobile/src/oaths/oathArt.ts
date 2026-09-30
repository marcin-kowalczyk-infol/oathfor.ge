// The Oath screen sheets of each art style are in src/art. The rule icon sheet keeps this cell order in every style.
/** Cell index of each icon in the rule icon sheet. reward and consequence are DUMMY icons until new art exists. */
export const ruleIcon = { start: 0, deadline: 1, cutoff: 2, proof: 3, review: 4, fixed: 5, pause: 6, fullRules: 7, reward: 8, consequence: 9 } as const;
export type RuleIconId = keyof typeof ruleIcon;
