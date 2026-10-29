/**
 * Claim patterns that must never appear in output unless the source data
 * supports them. Each entry is checked against the generated text; if it
 * matches there but `support` does not match the source data, it is flagged.
 */
export interface ClaimPattern {
  id: string;
  label: string;
  pattern: RegExp;
  /** What to look for in the source data to treat the claim as supported. Defaults to `pattern`. */
  support?: RegExp;
}

export const CLAIM_PATTERNS: ClaimPattern[] = [
  { id: "certification", label: "certification", pattern: /\b(certified|certification|certificate|accredited)\b/i },
  { id: "standards", label: "standards mark", pattern: /\b(FDA|CE[- ]marked|CE mark|UL[- ]listed|ETL|RoHS|FCC|ISO ?\d{3,5}|EN ?\d{3,5}|ASTM|CPSC|Energy Star|OEKO-TEX|GOTS|FSC|USDA)\b/ },
  { id: "warranty", label: "warranty or guarantee", pattern: /\b(warrant(y|ies|ed)|guarantee[ds]?|money[- ]back|lifetime (replacement|support))\b/i },
  { id: "organic", label: "organic / natural claim", pattern: /\b(organic|all[- ]natural|100% natural|chemical[- ]free|non[- ]toxic)\b/i },
  { id: "free-from", label: "free-from claim", pattern: /\b(BPA[- ]free|gluten[- ]free|lead[- ]free|paraben[- ]free|cruelty[- ]free|vegan|hypoallergenic|allergen[- ]free|PFAS[- ]free|phthalate[- ]free)\b/i },
  { id: "eco", label: "environmental claim", pattern: /\b(eco[- ]friendly|sustainabl[ey]|biodegradable|compostable|recyclable|carbon[- ]neutral|zero[- ]waste|environmentally friendly)\b/i },
  { id: "medical", label: "health or medical claim", pattern: /\b(clinically|dermatologist|doctor[- ]recommended|cures?|heals?|treats?|prevents?|relieves?|therapeutic|medical[- ]grade|antibacterial|antimicrobial|kills \d+%)\b/i },
  { id: "proof", label: "test or proof claim", pattern: /\b(proven|tested|lab[- ]tested|scientifically|studies show)\b/i },
  { id: "water", label: "water/weather resistance", pattern: /\b(waterproof|water[- ]resistant|weatherproof|IP\d{2}|splash[- ]proof|shockproof|drop[- ]proof)\b/i },
  { id: "origin", label: "country of origin", pattern: /\b(made in|handmade in|crafted in|manufactured in|sourced from)\s+[A-Z]/ },
  { id: "handmade", label: "handmade claim", pattern: /\b(hand[- ]?made|handcrafted|hand[- ]crafted|artisan)\b/i },
  { id: "patent", label: "patent claim", pattern: /\b(patent(ed)?|patent[- ]pending)\b/i },
  { id: "superlative", label: "superlative or ranking", pattern: /(#\s?1\b|\bnumber one\b|\bbest[- ]selling\b|\bbestseller\b|\baward[- ]winning\b|\bworld'?s (best|first|leading)\b|\bthe best\b|\bunbeatable\b)/i },
  { id: "safety", label: "safety claim", pattern: /\b(food[- ]safe|food[- ]grade|child[- ]safe|non[- ]slip|fire[- ]resistant|flame[- ]retardant|safe for (babies|kids|children|pets))\b/i },
  { id: "shipping", label: "shipping or returns promise", pattern: /\b(free shipping|free returns|ships (today|same day)|next[- ]day delivery)\b/i },
];
