// utils/parseNaturalQuery.js

const numberWords = {
  one: 1, single: 1, double: 2, triple: 3, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20,
};

const extractNumber = (str) => {
  if (!str && str !== 0) return null;
  const clean = String(str).toLowerCase().replace(/(?:st|nd|rd|th)$/, ""); // accept 1st, 2nd, 3rd, 4th
  const num = parseInt(clean, 10);
  if (!isNaN(num)) return num;
  return numberWords[clean] || null;
};

export const parseNaturalQuery = (query) => {
  if (!query || typeof query !== "string") {
    const err = new Error("Unable to parse natural language query");
    err.status = 400;
    throw err;
  }

  const filters = {};
  const normalized = query.toLowerCase().trim();

  // reject clearly invalid inputs early
  if (!/[a-z0-9\s]/.test(normalized)) {
    const err = new Error("Unable to parse natural language query");
    err.status = 400;
    throw err;
  }

  // -------------------------
  // 1) PALINDROME
  // -------------------------
  if (/\b(non[-\s]?palindromic|not\s+(?:a\s+)?palindrome|isn['']?t\s+(?:a\s+)?palindrome|aren't?\s+palindromes?)\b/.test(normalized)) {
    filters.is_palindrome = false;
  }
  if (/\b(palindromic|palindrome|are\s+palindrome|is\s+a\s+palindrome)\b/.test(normalized)) {
    if (filters.is_palindrome === undefined) filters.is_palindrome = true;
  }

  // -------------------------
  // 2) WORD COUNT
  // -------------------------
  // Match patterns like "single word", "two words", "all single word"
  const wordCountMatch = normalized.match(/\b(?:all\s+)?(one|single|double|triple|two|three|four|five|six|seven|eight|nine|ten)(?:\s+\w+)*\s+(?:word|string|text)s?\b/);

  if (wordCountMatch && wordCountMatch[1]) {
    const num = extractNumber(wordCountMatch[1]);
    if (num) filters.word_count = num;
  }

  // -------------------------
  // 3) LENGTH (aggregate multiple)
  // -------------------------
  const longerMatches = [...normalized.matchAll(/\b(?:longer|greater|more|exceeding|beyond|higher|over|above)\s+(?:word(?:s)?\s+)?(?:than\s+)?(\w+)/g)];
  const shorterMatches = [...normalized.matchAll(/\b(?:shorter|less|fewer|below|under|not\s+up\s+to)\s+(?:word(?:s)?\s+)?(?:than\s+)?(\w+)/g)];
  const betweenMatches = [...normalized.matchAll(/\b(?:between|from)\s+(\w+)\s+(?:and|to)\s+(\w+)/g)];
  const atLeastMatches = [...normalized.matchAll(/\b(?:at\s+least|min(?:imum)?)\s+(\w+)/g)];
  const atMostMatches = [...normalized.matchAll(/\b(?:at\s+most|max(?:imum)?)\s+(\w+)/g)];

  let minLength = undefined;
  let maxLength = undefined;

  for (const m of longerMatches) {
    const n = extractNumber(m[1]);
    if (n !== null) minLength = Math.max(minLength || 0, n + 1);
  }
  for (const m of shorterMatches) {
    const n = extractNumber(m[1]);
    if (n !== null) maxLength = Math.min(maxLength || Infinity, n - 1);
  }
  for (const m of betweenMatches) {
    const mn = extractNumber(m[1]);
    const mx = extractNumber(m[2]);
    if (mn === null || mx === null) {
      const err = new Error("Unable to parse natural language query");
      err.status = 400;
      throw err;
    }
    if (mn >= mx) {
      const err = new Error("Query parsed but resulted in conflicting filters");
      err.status = 422;
      throw err;
    }
    minLength = mn;
    maxLength = mx;
  }
  for (const m of atLeastMatches) {
    const n = extractNumber(m[1]);
    if (n !== null) minLength = Math.max(minLength || 0, n);
  }
  for (const m of atMostMatches) {
    const n = extractNumber(m[1]);
    if (n !== null) maxLength = Math.min(maxLength || Infinity, n);
  }

  if (minLength !== undefined) filters.min_length = minLength;
  if (maxLength !== undefined && maxLength !== Infinity) filters.max_length = maxLength;

  // -------------------------
  // 4) ORDINAL VOWEL / CONSONANT / LETTER (handles 'of' and 'of the' forms)
  // Process this BEFORE the general contains_character to prioritize ordinal matches
  // Examples:
  //  - "first vowel", "first vowel of the word", "first vowel of the alphabet"
  //  - "third letter of the alphabet"
  //  - "second consonant of alphabet"
  //  - "contain the first vowel"
  // -------------------------
  const ordinalToIndex = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
  const vowels = ['a', 'e', 'i', 'o', 'u'];
  const consonants = [...'bcdfghjklmnpqrstvwxyz'];
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

  // More flexible pattern that doesn't require word boundary at start
  // Matches: "contain the first vowel", "the first vowel", "first vowel of alphabet", etc.
  const ordinalRe = /(?:contain(?:s|ing)?|include(?:s|ing)?|has|with|having|that\s+contain(?:s|ing)?|that\s+has)?\s*(?:the\s+)?(first|second|third|fourth|fifth|\d+)(?:st|nd|rd|th)?\s+(vowel|consonant|letter)(?:\s+of(?:\s+the)?\s+(word|alphabet))?/gi;
  let orMatch;
  const ordinalMatches = [];
  while ((orMatch = ordinalRe.exec(normalized)) !== null) {
    ordinalMatches.push(orMatch);
  }
  
  if (ordinalMatches.length > 0) {
    const last = ordinalMatches[ordinalMatches.length - 1];
    let ord = last[1];
    let kind = last[2];
    const ofTarget = last[3]; // might be undefined, or 'word' or 'alphabet'

    // normalize ord: could be number-word or numeric string
    const ordNum = extractNumber(ord) || ordinalToIndex[ord.toLowerCase()] || null;

    // if kind === 'letter' + ofTarget === 'alphabet' => map nth alphabet letter
    if (kind === 'letter' && ofTarget === 'alphabet') {
      const idx = ordNum;
      if (idx !== null && idx >= 1 && idx <= alphabet.length) {
        filters.contains_character = alphabet[idx - 1];
      } else {
        const err = new Error("Unable to parse natural language query");
        err.status = 400;
        throw err;
      }
    } else if (kind === 'vowel') {
      // if "of alphabet" -> nth vowel in alphabet ordering (vowels array)
      if (ofTarget === 'alphabet') {
        const idx = ordNum;
        if (idx !== null && idx >= 1 && idx <= vowels.length) {
          filters.contains_character = vowels[idx - 1];
        } else {
          const err = new Error("Unable to parse natural language query");
          err.status = 400;
          throw err;
        }
      } else {
        // no 'alphabet' target: interpret as ordinal vowel (first vowel => 'a', second => 'e', etc.)
        const idx = ordNum;
        if (idx !== null && idx >= 1 && idx <= vowels.length) {
          filters.contains_character = vowels[idx - 1];
        }
      }
    } else if (kind === 'consonant') {
      if (ofTarget === 'alphabet') {
        const idx = ordNum;
        if (idx !== null && idx >= 1 && idx <= consonants.length) {
          filters.contains_character = consonants[idx - 1];
        } else {
          const err = new Error("Unable to parse natural language query");
          err.status = 400;
          throw err;
        }
      } else {
        const idx = ordNum;
        if (idx !== null && idx >= 1 && idx <= consonants.length) {
          filters.contains_character = consonants[idx - 1];
        }
      }
    }
  }

  // -------------------------
  // 5) CONTAINS CHARACTER (robust) - only if not already set by ordinal logic
  // -------------------------
  if (!filters.contains_character) {
    const containsRe = /\b(?:contain(?:s|ing)?|include(?:s|ing)?|has|with|having)\s+(?:the\s+)?(?:letter\s+)?([a-z])\b/g;
    const containsMatches = [...normalized.matchAll(containsRe)];
    if (containsMatches.length > 0) {
      const last = containsMatches[containsMatches.length - 1];
      if (last && last[1]) filters.contains_character = last[1];
    }
  }

  // -------------------------
  // 6) NEGATIVE CONTAINS: we intentionally do not keep exclude field;
  // treat negative contain patterns as unsupported (422 per spec)
  // -------------------------
  if (/\b(?:does\s+not|doesn['']?t|without|excluding|not)\b\s*(?:contain|include|have)\b/.test(normalized)) {
    const err = new Error("Query parsed but resulted in conflicting filters");
    err.status = 422;
    throw err;
  }

  // -------------------------
  // 7) FINAL VALIDATION
  // -------------------------
  if (Object.keys(filters).length === 0) {
    const err = new Error("Unable to parse natural language query");
    err.status = 400;
    throw err;
  }

  if (
    filters.min_length !== undefined &&
    filters.max_length !== undefined &&
    filters.min_length > filters.max_length
  ) {
    const err = new Error("Query parsed but resulted in conflicting filters");
    err.status = 422;
    throw err;
  }

  return { parsed_filters: filters };
};