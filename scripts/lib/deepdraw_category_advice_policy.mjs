export function categoryAdviceDomain(official) {
  if (/鞋|靴/.test(official)) return 'shoe';
  if (/袜|帽|围巾|手套|包包|箱包|背包|配饰/.test(official)) return 'accessory';
  if (/童装|服装|婴儿装|亲子装/.test(official)) return 'apparel';
  return null;
}
export function categoryCandidateMatchesFacts(trade, facts) {
  const path = String(trade.trade_path || '');
  const domain = categoryAdviceDomain(facts.officialCategory?.[0] || '');
  if (!domain || /待删|废弃/.test(path)) return false;
  if (domain === 'shoe' && !/鞋|靴/.test(path)) return false;
  if (domain === 'apparel' && /鞋|靴|袜|帽|围巾|手套|包包|箱包|背包/.test(path)) return false;
  if (domain === 'accessory' && !/袜|帽|围巾|手套|包|配件|配饰/.test(path)) return false;
  const genders = facts.gender || [];
  if (/男童|男孩/.test(path) && !(genders.length === 1 && /^(男|男童|男孩)$/.test(genders[0]))) return false;
  if (/女童|女孩/.test(path) && !(genders.length === 1 && /^(女|女童|女孩)$/.test(genders[0]))) return false;
  const ages = facts.age || [];
  if (/婴童|婴儿/.test(path) && !/婴幼儿服装/.test(path) && !(ages.length === 1 && /^(婴童|婴儿)$/.test(ages[0]))) return false;
  // "婴幼儿服装" is the platform's general root, not an age restriction.
  if (/婴童配件|婴儿配件/.test(path) && !(ages.length === 1 && /^(婴童|婴儿)$/.test(ages[0]))) return false;
  if (/中大童/.test(path) && !(ages.length === 1 && /^(中童|大童|中大童)$/.test(ages[0]))) return false;
  return true;
}
export function shouldRequestCategoryAdvice(decision, facts) {
  return facts.officialCategory?.length === 1
    && !['human_confirmed', 'human_adjusted'].includes(decision.status)
    && ['missing_semantic_match', 'ambiguous_match'].includes(decision.reasonCode)
    && categoryAdviceDomain(facts.officialCategory[0]) !== null;
}
