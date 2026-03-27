"use client";

export const MEDICAL_TAG_IDS = [
  'consent', 'allergy', 'medication', 'surgical-risk',
  'diagnosis', 'symptom', 'procedure', 'dosage', 'history',
];

// Verbal aliases for each medical tag ID
const TAG_ALIASES = {
  'consent':       ['informed consent', 'consent', 'authorization', 'permission'],
  'allergy':       ['allergic reaction', 'allergy', 'allergic', 'intolerance'],
  'medication':    ['medication', 'medicine', 'prescription', 'drug', 'meds'],
  'surgical-risk': ['anesthesia risk', 'surgical risk', 'surgery risk', 'surgical', 'anesthesia'],
  'diagnosis':     ['diagnosis', 'condition', 'disease', 'disorder', 'finding'],
  'symptom':       ['symptoms', 'symptom', 'complaint', 'pain'],
  'procedure':     ['procedure', 'lab work', 'biopsy', 'scan', 'test', 'lab'],
  'dosage':        ['dosing', 'dosage', 'frequency', 'dose'],
  'history':       ['family history', 'past history', 'previous', 'history', 'prior'],
};

// Verbal command prefixes that precede a tag name
const COMMAND_PREFIXES = [
  'record as', 'classify as', 'this is', 'flag', 'tag', 'note', 'mark', 'label',
];

// Build reverse lookup: alias (lowercase) → tag ID
// Longer aliases first so multi-word phrases match before single words
function buildAliasLookup() {
  const entries = [];
  for (const [tagId, aliases] of Object.entries(TAG_ALIASES)) {
    for (const alias of aliases) {
      entries.push([alias.toLowerCase(), tagId]);
    }
  }
  entries.sort((a, b) => b[0].length - a[0].length);
  return new Map(entries);
}

const ALIAS_LOOKUP = buildAliasLookup();

function resolveAlias(token) {
  const lower = token.toLowerCase().trim();
  return ALIAS_LOOKUP.get(lower) ?? null;
}

/**
 * Detect medical tag verbal commands in speech text and strip them.
 *
 * e.g. "I have an allergy to penicillin, flag allergy"
 *   → { text: "I have an allergy to penicillin", tags: ["allergy"] }
 *
 * @param {string} text - cleaned transcript text
 * @returns {{ text: string, tags: string[] }}
 */
export function applyVoiceTagging(text) {
  if (!text?.trim()) return { text: text ?? '', tags: [] };

  let cleaned = text;
  const detectedTags = new Set();

  // Step 1: detect explicit verbal command phrases and strip them
  for (const prefix of COMMAND_PREFIXES) {
    // Match: <prefix> <captured token up to 30 chars>
    const regex = new RegExp(
      `(?:^|[,\\s])${prefix}\\s+([a-z][a-z\\s\\-]{1,30})`,
      'gi'
    );
    cleaned = cleaned.replace(regex, (match, captured) => {
      const tagId = resolveAlias(captured.trim());
      if (tagId) {
        detectedTags.add(tagId);
        return ''; // strip the whole command phrase
      }
      return match; // leave unchanged if token didn't resolve
    });
  }

  // Step 2: scan remaining text for standalone alias matches (no command verb needed)
  // Iterate aliases longest-first so "surgical risk" matches before "surgical"
  for (const [alias, tagId] of ALIAS_LOOKUP) {
    if (detectedTags.has(tagId)) continue; // already detected via command
    const escaped = alias.replace(/[-]/g, '\\-');
    const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$|[.,!?])`, 'i');
    if (regex.test(cleaned)) {
      detectedTags.add(tagId);
    }
  }

  // Step 3: clean up dangling punctuation and extra spaces
  cleaned = cleaned
    .replace(/[,\s]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { text: cleaned, tags: [...detectedTags] };
}
