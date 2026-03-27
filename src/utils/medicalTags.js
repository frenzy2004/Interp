// ─── MEDICAL TAGS ───────────────────────────────────────────────────────────
// Client-safe utility — no server dependencies

const MEDICAL_TAG_DEFINITIONS = [
  { id: 'consent', keywords: ['consent', 'agree', 'permission', 'authorize', 'sign', 'informed consent', 'risks', 'benefits', 'alternatives'] },
  { id: 'allergy', keywords: ['allergy', 'allergic', 'reaction', 'anaphylaxis', 'intolerance', 'sensitive'] },
  { id: 'medication', keywords: ['medication', 'medicine', 'drug', 'prescription', 'dose', 'pill', 'tablet', 'mg', 'milligrams'] },
  { id: 'surgical-risk', keywords: ['surgery', 'surgical', 'operation', 'procedure', 'incision', 'anesthesia', 'complication', 'bleeding', 'infection'] },
  { id: 'diagnosis', keywords: ['diagnosis', 'diagnosed', 'condition', 'disease', 'disorder'] },
  { id: 'symptom', keywords: ['pain', 'fever', 'nausea', 'dizzy', 'headache', 'swelling', 'bleeding', 'fatigue', 'vomiting', 'symptom'] },
  { id: 'procedure', keywords: ['procedure', 'test', 'scan', 'x-ray', 'MRI', 'CT', 'biopsy', 'ultrasound', 'blood test', 'lab'] },
  { id: 'dosage', keywords: ['dosage', 'dose', 'twice daily', 'once daily', 'every', 'hours', 'mg', 'ml', 'tablets'] },
  { id: 'history', keywords: ['history', 'previous', 'past', 'family history', 'chronic', 'pre-existing'] },
];

export function detectMedicalTags(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = [];
  for (const tag of MEDICAL_TAG_DEFINITIONS) {
    for (const kw of tag.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        found.push(tag.id);
        break;
      }
    }
  }
  return [...new Set(found)];
}
