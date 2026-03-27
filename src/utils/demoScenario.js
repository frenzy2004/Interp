export const DEMO_SCENARIO = {
  physicianLang: 'en',
  patientLang: 'es',
  encounterType: 'surgery',
  exchanges: [
    {
      role: 'physician',
      delay: 0,
      originalText: "Good morning. I'm Dr. Martinez. We need to perform a laparoscopic cholecystectomy to remove your gallbladder tomorrow.",
      expectedTags: ['procedure', 'surgical-risk'],
    },
    {
      role: 'patient',
      delay: 4000,
      originalText: "¿Qué es eso? No entiendo qué me van a hacer.",
      expectedTags: [],
    },
    {
      role: 'physician',
      delay: 4000,
      originalText: "I understand. Let me explain in a simple way: we will make 3 small cuts in your belly, use a tiny camera to find the gallbladder, and take it out. You will go home the same day.",
      expectedTags: ['consent', 'procedure'],
    },
    {
      role: 'patient',
      delay: 4000,
      originalText: "Ah, entiendo. ¿Tres cortecitos pequeños? ¿Y me voy a casa el mismo día?",
      expectedTags: [],
    },
    {
      role: 'physician',
      delay: 3000,
      originalText: "Yes, exactly. Before we proceed, I need to ask: are you allergic to any medications?",
      expectedTags: ['consent', 'allergy'],
    },
    {
      role: 'patient',
      delay: 3000,
      originalText: "Sí, soy alérgica a la penicilina. Me da una reacción muy fuerte.",
      expectedTags: ['allergy', 'medication'],
    },
  ],
};
