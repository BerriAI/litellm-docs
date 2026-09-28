// Fuzzy post search, moved unchanged from the previous blog list page:
// title, description, keywords, tags, and authors, tolerant of typos.

function searchableText(item) {
  const metadata = item.content?.metadata || {};
  return [
    metadata.title,
    metadata.description,
    ...(metadata.frontMatter?.keywords || []),
    ...(metadata.tags || []).map(tag => tag.label),
    ...(metadata.authors || []).map(author => author.name),
  ].filter(Boolean).join(' ').toLowerCase();
}

export function queryTokens(query) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function maxEditDistance(token) {
  if (token.length <= 3) return 0;
  if (token.length <= 5) return 1;
  return 2;
}

function levenshteinDistance(first, second, maxDistance) {
  if (Math.abs(first.length - second.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({length: second.length + 1}, (_, index) => index);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex++) {
    const current = [firstIndex];
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex++) {
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1)
      );
    }
    previous = current;
  }

  return previous[second.length];
}

function isSubsequence(token, word) {
  let tokenIndex = 0;
  for (const character of word) {
    if (character === token[tokenIndex]) tokenIndex++;
  }
  return tokenIndex === token.length;
}

function tokenScore(word, token) {
  if (word === token) return 4;
  if (word.startsWith(token)) return 3;
  if (word.includes(token)) return 2;
  if (levenshteinDistance(word, token, maxEditDistance(token)) <= maxEditDistance(token)) return 1;
  if (token.length >= 4 && isSubsequence(token, word)) return 0.5;
  return null;
}

export function itemScore(item, tokens) {
  if (tokens.length === 0) return 0;

  const words = searchableText(item).match(/[\p{L}\p{N}]+/gu) || [];
  return tokens.reduce((score, token) => {
    const bestTokenScore = words.reduce((best, word) => {
      const current = tokenScore(word, token);
      return current !== null && current > best ? current : best;
    }, null);

    return score === null || bestTokenScore === null ? null : score + bestTokenScore;
  }, 0);
}
