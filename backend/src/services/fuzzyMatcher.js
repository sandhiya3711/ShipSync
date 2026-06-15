const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Clean and normalize company names
 */
function cleanName(str) {
  if (!str) return '';

  return str
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .replace(
      /\b(pvt|ltd|co|company|corp|corporation|inc|incorporated|limited|llp|gmbh|solutions|logistics|shipping|couriers)\b/g,
      ''
    )
    .trim();
}

/**
 * Levenshtein Distance
 */
function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        s1[i - 1] === s2[j - 1]
          ? dp[i - 1][j - 1]
          : Math.min(
              dp[i - 1][j] + 1,
              dp[i][j - 1] + 1,
              dp[i - 1][j - 1] + 1
            );
    }
  }

  return dp[m][n];
}

/**
 * Similarity score (0 → 1)
 */
function getSimilarity(s1, s2) {
  const clean1 = cleanName(s1);
  const clean2 = cleanName(s2);

  if (!clean1 || !clean2) return 0;
  if (clean1 === clean2) return 1;

  const distance = levenshteinDistance(clean1, clean2);
  const maxLength = Math.max(clean1.length, clean2.length);
  const levenshteinSim = 1 - distance / maxLength;

  const tokens1 = new Set(clean1.split(' '));
  const tokens2 = new Set(clean2.split(' '));

  const intersection = [...tokens1].filter(x => tokens2.has(x));
  const union = new Set([...tokens1, ...tokens2]);

  const jaccardSim = union.size === 0 ? 0 : intersection.length / union.size;

  return 0.7 * levenshteinSim + 0.3 * jaccardSim;
}

/**
 * SAFE: Only returns best match — NO DB writes
 */
async function findCanonicalCompany(rawName, companiesCache = null) {
  const normalizedRaw = (rawName || '').trim();
  if (!normalizedRaw) {
    return { name: 'Unknown', id: null, isNew: true };
  }

  const cleanRaw = cleanName(normalizedRaw);
  if (!cleanRaw) {
    return { name: 'Unknown', id: null, isNew: true };
  }

  const companies =
    companiesCache || (await prisma.company.findMany());

  // ---------------------------
  // PHASE 1: EXACT MATCH
  // ---------------------------
  for (const company of companies) {
    if (
      company.name.toLowerCase() === normalizedRaw.toLowerCase() ||
      cleanName(company.name) === cleanRaw
    ) {
      return { name: company.name, id: company.id, isNew: false };
    }

    if (company.aliases) {
      const aliases = company.aliases.split(',').map(a => a.trim());

      if (
        aliases.some(
          a =>
            a.toLowerCase() === normalizedRaw.toLowerCase() ||
            cleanName(a) === cleanRaw
        )
      ) {
        return { name: company.name, id: company.id, isNew: false };
      }
    }
  }

  // ---------------------------
  // PHASE 2: FUZZY MATCH
  // ---------------------------
  let bestMatch = null;
  let bestScore = 0;

  const THRESHOLD = 0.85; // 🔥 FIXED (was 0.65)

  for (const company of companies) {
    const score = getSimilarity(normalizedRaw, company.name);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = company;

      if (bestScore >= 0.95) break;
    }

    if (company.aliases) {
      const aliases = company.aliases.split(',').map(a => a.trim());

      for (const alias of aliases) {
        const aliasScore = getSimilarity(normalizedRaw, alias);

        if (aliasScore > bestScore) {
          bestScore = aliasScore;
          bestMatch = company;

          if (bestScore >= 0.95) break;
        }
      }
    }
  }

  if (bestMatch && bestScore >= THRESHOLD) {
    console.log(
      `Fuzzy matched: "${rawName}" → "${bestMatch.name}" (Score: ${bestScore.toFixed(2)})`
    );

    return {
      name: bestMatch.name,
      id: bestMatch.id,
      isNew: false,
    };
  }

  // ---------------------------
  // NO MATCH → DO NOT CREATE DB HERE
  // ---------------------------
  return {
    name: normalizedRaw,
    id: null,
    isNew: true,
  };
}

/**
 * OPTIONAL: batch create new companies AFTER parsing
 */
async function createMissingCompanies(rawNames = []) {
  const created = [];

  for (const name of rawNames) {
    try {
      const company = await prisma.company.create({
        data: {
          name,
          aliases: cleanName(name),
        },
      });

      created.push(company);
    } catch (e) {
      const existing = await prisma.company.findUnique({
        where: { name },
      });

      if (existing) created.push(existing);
    }
  }

  return created;
}

module.exports = {
  cleanName,
  getSimilarity,
  findCanonicalCompany,
  createMissingCompanies,
};