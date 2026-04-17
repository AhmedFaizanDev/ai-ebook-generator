export type OutputLanguage = 'en' | 'fr' | 'de' | 'hi';

const ALLOWED = new Set<OutputLanguage>(['en', 'fr', 'de', 'hi']);

const ALIASES: Record<string, OutputLanguage> = {
  en: 'en',
  eng: 'en',
  english: 'en',
  fr: 'fr',
  fra: 'fr',
  fre: 'fr',
  french: 'fr',
  de: 'de',
  deu: 'de',
  ger: 'de',
  german: 'de',
  deutsch: 'de',
  hi: 'hi',
  hin: 'hi',
  hindi: 'hi',
  hi_in: 'hi',
};

/** Restore `outputLanguage` from persisted JSON (never coerce de/hi to en). */
export function normalizeStoredOutputLanguage(raw: unknown): OutputLanguage {
  if (raw === 'fr' || raw === 'de' || raw === 'hi') return raw;
  return 'en';
}

/** English vs localized bibliography heading sets (validator accepts native + EN where noted). */
export const BIBLIOGRAPHY_HEADINGS = {
  en: {
    main: 'Bibliography',
    books: '### Books',
    papers: '### Research Papers & Standards',
    online: '### Online Resources',
  },
  fr: {
    main: 'Bibliographie',
    books: '### Ouvrages',
    papers: '### Articles et normes',
    online: '### Ressources en ligne',
  },
  de: {
    main: 'Literaturverzeichnis',
    books: '### Bücher',
    papers: '### Forschungsarbeiten und Normen',
    online: '### Online-Ressourcen',
  },
  hi: {
    main: 'ग्रंथसूची',
    books: '### पुस्तकें',
    papers: '### शोध पत्र और मानक',
    online: '### ऑनलाइन संसाधन',
  },
} as const;

export interface BookShellStrings {
  coverLogoAlt: string;
  catalogTitle: string;
  catalogAuthoredBy: string;
  catalogPagesCm: string;
  catalogContributed: string;
  catalogIncludes: string;
  catalogIsbnLabel: string;
  publishedBy: string;
  allRightsReserved: string;
  copyrightNoReproduction: string;
  limitsHeading: string;
  limitsBody: string;
  trademarksHeading: string;
  trademarksBody: string;
  tableOfContents: string;
  unitWord: string;
  summary: string;
  exercises: string;
  capstoneProjects: string;
  caseStudies: string;
  glossary: string;
  bibliography: string;
  glossaryAnchor: string;
  bibliographyAnchor: string;
  capstoneAnchor: string;
  caseStudyAnchor: string;
}

/** Slug for heading text (Latin accents folded; Devanagari kept as NFC grapheme clusters — do not strip combining marks). */
export function slugifyHeadingId(text: string): string {
  const hasDevanagari = /\p{Script=Devanagari}/u.test(text);
  if (hasDevanagari) {
    const slug = text
      .normalize('NFC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\u0900-\u097Fa-z0-9-]+/giu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return slug || 'section';
  }
  const base = text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  const slug = base
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
  return slug || 'section';
}

export function markdownCapstoneH1(lang: OutputLanguage): string {
  if (lang === 'fr') return '# Projets de synthèse';
  if (lang === 'de') return '# Abschlussprojekte';
  if (lang === 'hi') return '# कैपस्टोन परियोजनाएँ';
  return '# Capstone Projects';
}

export function markdownCaseStudyH1(lang: OutputLanguage): string {
  if (lang === 'fr') return '# Études de cas';
  if (lang === 'de') return '# Fallstudien';
  if (lang === 'hi') return '# केस अध्ययन';
  return '# Case Studies';
}

export function capstoneH2Line(unitIndex: number, capstoneTitle: string, lang: OutputLanguage): string {
  const i = unitIndex + 1;
  if (lang === 'fr') return `## Projet de synthèse ${i} : ${capstoneTitle}`;
  if (lang === 'de') return `## Abschlussprojekt ${i}: ${capstoneTitle}`;
  if (lang === 'hi') return `## कैपस्टोन परियोजना ${i}: ${capstoneTitle}`;
  return `## Capstone Project ${i}: ${capstoneTitle}`;
}

export function caseStudyH2Line(unitIndex: number, caseStudyTitle: string, lang: OutputLanguage): string {
  const i = unitIndex + 1;
  if (lang === 'fr') return `## Étude de cas ${i} : ${caseStudyTitle}`;
  if (lang === 'de') return `## Fallstudie ${i}: ${caseStudyTitle}`;
  if (lang === 'hi') return `## केस अध्ययन ${i}: ${caseStudyTitle}`;
  return `## Case Study ${i}: ${caseStudyTitle}`;
}

/** Regex source (no slashes) for splitting batched capstone markdown on each H2. */
export function capstoneBatchedSplitSource(lang: OutputLanguage): string {
  if (lang === 'fr') return '^## Projet de synthèse \\d';
  if (lang === 'de') return '^## Abschlussprojekt \\d';
  if (lang === 'hi') return '^## कैपस्टोन परियोजना \\d';
  return '^## Capstone Project \\d';
}

export function caseStudyBatchedSplitSource(lang: OutputLanguage): string {
  if (lang === 'fr') return '^## Étude de cas \\d';
  if (lang === 'de') return '^## Fallstudie \\d';
  if (lang === 'hi') return '^## केस अध्ययन \\d';
  return '^## Case Study \\d';
}

/** Prefix for ### sub-sections under one capstone (e.g. "Capstone 1.1"). */
export function capstoneSubsectionPrefix(lang: OutputLanguage, capstoneIndex: number): string {
  const n = capstoneIndex + 1;
  if (lang === 'fr') return `Projet de synthèse ${n}`;
  if (lang === 'de') return `Abschlussprojekt ${n}`;
  if (lang === 'hi') return `कैपस्टोन परियोजना ${n}`;
  return `Capstone ${n}`;
}

/** Prefix for ### sub-sections under one case study. */
export function caseStudySubsectionPrefix(lang: OutputLanguage, caseIndex: number): string {
  const n = caseIndex + 1;
  if (lang === 'fr') return `Étude de cas ${n}`;
  if (lang === 'de') return `Fallstudie ${n}`;
  if (lang === 'hi') return `केस अध्ययन ${n}`;
  return `Case Study ${n}`;
}

export function unitEndSummaryHeading(unitNum: number, lang: OutputLanguage): string {
  if (lang === 'fr') return `## Synthèse de l'unité ${unitNum}`;
  if (lang === 'de') return `## Zusammenfassung der Einheit ${unitNum}`;
  if (lang === 'hi') return `## इकाई ${unitNum} का सारांश`;
  return '## Summary';
}

export function unitExercisesHeading(unitNum: number, lang: OutputLanguage): string {
  if (lang === 'fr') return `## Exercices de l'unité ${unitNum}`;
  if (lang === 'de') return `## Übungen zu Einheit ${unitNum}`;
  if (lang === 'hi') return `## इकाई ${unitNum} के अभ्यास`;
  return '## Exercises';
}

/** Outline line for unit i (used in prompts). */
export function unitOutlineLine(lang: OutputLanguage, index: number, title: string): string {
  const i = index + 1;
  if (lang === 'fr') return `Unité ${i} : ${title}`;
  if (lang === 'de') return `Einheit ${i}: ${title}`;
  if (lang === 'hi') return `इकाई ${i}: ${title}`;
  return `Unit ${i}: ${title}`;
}

/** Label before unit summary in capstone/case prompts. */
export function unitSummaryLabel(lang: OutputLanguage, i: number): string {
  const n = i + 1;
  if (lang === 'fr') return `Unité ${n}`;
  if (lang === 'de') return `Einheit ${n}`;
  if (lang === 'hi') return `इकाई ${n}`;
  return `Unit ${n}`;
}

/** Extra JSON language rule for structure prompt (empty for English). */
export function structureJsonLanguageRule(lang: OutputLanguage): string {
  if (lang === 'fr') {
    return 'All human-readable strings in the JSON (book title, every unitTitle, every subtopic string, every capstoneTopics entry, every caseStudyTopics entry) must be written in French.';
  }
  if (lang === 'de') {
    return 'All human-readable strings in the JSON (book title, every unitTitle, every subtopic string, every capstoneTopics entry, every caseStudyTopics entry) must be written in German.';
  }
  if (lang === 'hi') {
    return 'All human-readable strings in the JSON (book title, every unitTitle, every subtopic string, every capstoneTopics entry, every caseStudyTopics entry) must be written in Hindi (Devanagari).';
  }
  return '';
}

const SHELL_EN: BookShellStrings = {
  coverLogoAlt: 'Cloud Nine Publishing House',
  catalogTitle: 'Cataloging in Publication Data',
  catalogAuthoredBy: 'Authored by:',
  catalogPagesCm: 'pages cm',
  catalogContributed: 'Contributed articles.',
  catalogIncludes: 'Includes citation and index.',
  catalogIsbnLabel: 'ISBN',
  publishedBy: 'Published by:',
  allRightsReserved: 'All rights reserved.',
  copyrightNoReproduction:
    'No part of this publication may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, or other electronic or mechanical methods, without the prior written permission of the publisher, except in the case of brief quotations embodied in critical reviews and certain other noncommercial uses permitted by copyright law.',
  limitsHeading: 'Limits of Liability / Disclaimer of Warranty:',
  limitsBody:
    'The publisher and the author have used their best efforts in preparing this book. The publisher and author make no representations or warranties with respect to the accuracy or completeness of the contents of this book and specifically disclaim any implied warranties of merchantability or fitness for a particular purpose. The advice and strategies contained herein may not be suitable for every situation. Neither the publisher nor the author shall be liable for any loss of profit or any other commercial damages, including but not limited to special, incidental, consequential, or other damages.',
  trademarksHeading: 'Trademarks:',
  trademarksBody:
    'All brand names and product names used in this book are trademarks, registered trademarks, or trade names of their respective holders.',
  tableOfContents: 'Table of Contents',
  unitWord: 'Unit',
  summary: 'Summary',
  exercises: 'Exercises',
  capstoneProjects: 'Capstone Projects',
  caseStudies: 'Case Studies',
  glossary: 'Glossary',
  bibliography: 'Bibliography',
  glossaryAnchor: 'glossary',
  bibliographyAnchor: 'bibliography',
  capstoneAnchor: 'capstone-projects',
  caseStudyAnchor: 'case-studies',
};

const SHELL_FR: BookShellStrings = {
  coverLogoAlt: 'Cloud Nine Publishing House',
  catalogTitle: 'Données de catalogage avant publication (CIP)',
  catalogAuthoredBy: 'Rédigé par :',
  catalogPagesCm: 'p. cm',
  catalogContributed: 'Articles de praticiens.',
  catalogIncludes: 'Comprend des références bibliographiques et un index.',
  catalogIsbnLabel: 'ISBN',
  publishedBy: 'Publié par :',
  allRightsReserved: 'Tous droits réservés.',
  copyrightNoReproduction:
    'Aucune partie de cette publication ne peut être reproduite, distribuée ou transmise sous quelque forme que ce soit, y compris la photocopie, l’enregistrement ou tout autre moyen électronique ou mécanique, sans l’autorisation écrite préalable de l’éditeur, sauf pour de brèves citations intégrées dans des comptes rendus critiques et certains autres usages non commerciaux autorisés par le droit d’auteur.',
  limitsHeading: 'Limites de responsabilité / clause de non-garantie :',
  limitsBody:
    'L’éditeur et l’auteur ont mis le meilleur de leurs efforts pour préparer cet ouvrage. Ils ne donnent aucune garantie quant à l’exactitude ou à l’exhaustivité du contenu et déclinent notamment toute garantie implicite de qualité marchande ou d’adéquation à un usage particulier. Les conseils et stratégies présentés peuvent ne pas convenir à toutes les situations. Ni l’éditeur ni l’auteur ne sauraient être tenus responsables de perte de profit ni d’autres dommages commerciaux, y compris accessoires, indirects ou consécutifs.',
  trademarksHeading: 'Marques :',
  trademarksBody:
    'Toutes les marques citées dans cet ouvrage sont des marques, marques déposées ou noms commerciaux de leurs détenteurs respectifs.',
  tableOfContents: 'Table des matières',
  unitWord: 'Unité',
  summary: 'Synthèse',
  exercises: 'Exercices',
  capstoneProjects: 'Projets de synthèse',
  caseStudies: 'Études de cas',
  glossary: 'Glossaire',
  bibliography: 'Bibliographie',
  glossaryAnchor: 'glossaire',
  bibliographyAnchor: 'bibliographie',
  capstoneAnchor: slugifyHeadingId('Projets de synthèse'),
  caseStudyAnchor: slugifyHeadingId('Études de cas'),
};

const SHELL_DE: BookShellStrings = {
  coverLogoAlt: 'Cloud Nine Publishing House',
  catalogTitle: 'Titelaufnahme vor der Veröffentlichung (CIP)',
  catalogAuthoredBy: 'Verfasst von:',
  catalogPagesCm: 'S. cm',
  catalogContributed: 'Beiträge von Autorinnen und Autoren.',
  catalogIncludes: 'Enthält Literaturangaben und ein Register.',
  catalogIsbnLabel: 'ISBN',
  publishedBy: 'Herausgegeben von:',
  allRightsReserved: 'Alle Rechte vorbehalten.',
  copyrightNoReproduction:
    'Kein Teil dieser Veröffentlichung darf in irgendeiner Form oder mit irgendwelchen Mitteln — einschließlich Fotokopie, Aufzeichnung oder andere elektronische oder mechanische Verfahren — reproduziert, verbreitet oder übertragen werden ohne die vorherige schriftliche Genehmigung des Verlags, außer in Fällen kurzer Zitate in kritischen Rezensionen und bestimmten anderen nichtkommerziellen Nutzungen, die das Urheberrecht erlaubt.',
  limitsHeading: 'Haftungsbeschränkung / Gewährleistungsausschluss:',
  limitsBody:
    'Verlag und Autor haben bei der Erstellung dieses Buches ihre besten Bemühungen eingesetzt. Sie übernehmen keine Gewähr für die Richtigkeit oder Vollständigkeit des Inhalts und schließen insbesondere stillschweigende Gewährleistungen der Marktgängigkeit oder Eignung für einen bestimmten Zweck aus. Die hierin enthaltenen Ratschläge und Strategien sind nicht für jede Situation geeignet. Weder Verlag noch Autor haften für entgangenen Gewinn oder sonstige kommerzielle Schäden, einschließlich begleitender, indirekter oder Folgeschäden.',
  trademarksHeading: 'Marken:',
  trademarksBody:
    'Alle in diesem Buch genannten Marken- und Produktnamen sind Marken, eingetragene Marken oder Handelsnamen der jeweiligen Inhaber.',
  tableOfContents: 'Inhaltsverzeichnis',
  unitWord: 'Einheit',
  summary: 'Zusammenfassung',
  exercises: 'Übungen',
  capstoneProjects: 'Abschlussprojekte',
  caseStudies: 'Fallstudien',
  glossary: 'Glossar',
  bibliography: 'Literaturverzeichnis',
  glossaryAnchor: slugifyHeadingId('Glossar'),
  bibliographyAnchor: slugifyHeadingId('Literaturverzeichnis'),
  capstoneAnchor: slugifyHeadingId('Abschlussprojekte'),
  caseStudyAnchor: slugifyHeadingId('Fallstudien'),
};

const SHELL_HI: BookShellStrings = {
  coverLogoAlt: 'Cloud Nine Publishing House',
  catalogTitle: 'प्रकाशन पूर्व अभिलेखन डेटा',
  catalogAuthoredBy: 'लेखक:',
  catalogPagesCm: 'पृ. से.मी.',
  catalogContributed: 'योगदान लेख।',
  catalogIncludes: 'उद्धरण और अनुक्रमणिका शामिल है।',
  catalogIsbnLabel: 'ISBN',
  publishedBy: 'प्रकाशक:',
  allRightsReserved: 'सर्वाधिकार सुरक्षित।',
  copyrightNoReproduction:
    'प्रकाशक की पूर्व लिखित अनुमति के बिना इस प्रकाशन का कोई भी भाग किसी भी रूप या किसी भी साधन — फोटोकॉपी, रिकॉर्डिंग या अन्य इलेक्ट्रॉनिक या यांत्रिक विधियों सहित — को पुनः उत्पादित, वितरित या प्रसारित नहीं किया जा सकता, सिवाय समालोचनात्मक समीक्षाओं में संक्षिप्त उद्धरणों और कॉपीराइट कानून द्वारा अनुमत अन्य गैर-व्यावसायिक उपयोगों के।',
  limitsHeading: 'दायित्व की सीमा / वारंटी अस्वीकरण:',
  limitsBody:
    'प्रकाशक और लेखक ने इस पुस्तक की तैयारी में अपनी पूरी कोशिश की है। वे सामग्री की शुद्धता या पूर्णता के संबंध में कोई प्रतिनिधित्व या वारंटी नहीं देते और विशेष रूप से व्यापारिकता या किसी विशेष उद्देश्य के अनुरूपता की निहित वारंटियों को अस्वीकार करते हैं। यहाँ दी गई सलाह हर स्थिति के लिए उपयुक्त नहीं हो सकती। न प्रकाशक न लेखक लाभ की हानि या अन्य व्यावसायिक नुकसानों के लिए उत्तरदायी होंगे।',
  trademarksHeading: 'ट्रेडमार्क:',
  trademarksBody:
    'इस पुस्तक में उपयोग किए गए सभी ब्रांड और उत्पाद नाम संबंधित धारकों के ट्रेडमार्क, पंजीकृत ट्रेडमार्क या व्यापार नाम हैं।',
  tableOfContents: 'विषय-सूची',
  unitWord: 'इकाई',
  summary: 'सारांश',
  exercises: 'अभ्यास',
  capstoneProjects: 'कैपस्टोन परियोजनाएँ',
  caseStudies: 'केस अध्ययन',
  glossary: 'शब्दावली',
  bibliography: 'ग्रंथसूची',
  glossaryAnchor: slugifyHeadingId('शब्दावली'),
  bibliographyAnchor: slugifyHeadingId('ग्रंथसूची'),
  capstoneAnchor: slugifyHeadingId('कैपस्टोन परियोजनाएँ'),
  caseStudyAnchor: slugifyHeadingId('केस अध्ययन'),
};

export function getShellStrings(lang: OutputLanguage): BookShellStrings {
  if (lang === 'fr') return SHELL_FR;
  if (lang === 'de') return SHELL_DE;
  if (lang === 'hi') return SHELL_HI;
  return SHELL_EN;
}

/**
 * Parse a language flag (ISO-style code or alias). Returns null if empty or unknown — no env fallback.
 * Used for batch CSV / Excel columns and for comparing resumed sessions.
 */
export function tryParseOutputLanguage(raw: string | null | undefined): OutputLanguage | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (!t) return null;
  const mapped = ALIASES[t];
  if (mapped) return mapped;
  if (ALLOWED.has(t as OutputLanguage)) return t as OutputLanguage;
  return null;
}

/**
 * Resolve book output language: optional per-row override (batch CSV `language` column) wins when valid;
 * otherwise `OUTPUT_LANGUAGE` (default `en`).
 */
export function resolveOutputLanguage(override?: string | null): OutputLanguage {
  const trimmedOverride = override != null ? String(override).trim() : '';
  if (trimmedOverride) {
    const fromOverride = tryParseOutputLanguage(trimmedOverride);
    if (fromOverride) return fromOverride;
    console.warn(
      `[OUTPUT_LANGUAGE] Unknown batch language flag "${trimmedOverride}". Using OUTPUT_LANGUAGE from environment instead.`,
    );
  }
  const raw = (process.env.OUTPUT_LANGUAGE ?? 'en').trim().toLowerCase();
  if (!raw) return 'en';
  const mapped = ALIASES[raw];
  if (mapped) return mapped;
  if (ALLOWED.has(raw as OutputLanguage)) return raw as OutputLanguage;
  console.warn(`[OUTPUT_LANGUAGE] Unknown code "${process.env.OUTPUT_LANGUAGE}", falling back to "en".`);
  return 'en';
}

const BOOK_LANG_DIRECTIVE: Record<Exclude<OutputLanguage, 'en'>, string> = {
  fr: `Write the entire book in French. That includes every Markdown heading (# and ##), all ### subheadings, preface and back-matter section titles, table headers and cell labels, bullet and numbered list text, exercise questions and answer lines, glossary entries, bibliography prose (with the French heading set you were given), capstone and case-study titles and body, figure/table captions, and Mermaid node labels when diagrams are allowed. Do not leave UI labels, instructions, or section titles in English. Keep LaTeX math notation as usual when equations are enabled; prose around math must be in French.`,
  de: `Write the entire book in German. That includes every Markdown heading (# and ##), all ### subheadings, preface and back-matter section titles, table headers and cell labels, bullet and numbered list text, exercise questions and answer lines, glossary entries, bibliography prose (with the German heading set you were given), capstone and case-study titles and body, figure/table captions, and Mermaid node labels when diagrams are allowed. Do not leave UI labels, instructions, or section titles in English. Keep LaTeX math notation as usual when equations are enabled; prose around math must be in German.`,
  hi: `Write the entire book in Hindi (Devanagari). That includes every Markdown heading (# and ##), all ### subheadings, preface and back-matter section titles, table headers and cell labels, bullet and numbered list text, exercise questions and answer lines, glossary entries, bibliography prose (with the Hindi heading set you were given), capstone and case-study titles and body, figure/table captions, and Mermaid node labels when diagrams are allowed. Do not leave UI labels, instructions, or section titles in English. Keep LaTeX math notation as usual when equations are enabled; explain symbols in Hindi where needed.`,
};

export function getLanguageDirective(lang: OutputLanguage): string {
  if (lang === 'en') return '';
  return `

Output language: ${BOOK_LANG_DIRECTIVE[lang]}`;
}

export function getPlainProseForNoMath(lang: OutputLanguage): string {
  if (lang === 'fr') {
    return 'Do NOT use mathematical equations, formulas, symbolic notation, LaTeX-style expressions, or symbol-heavy representations (e.g. E=mc², ∑, ∫, √, α, β, Δ, H₀). Explain all quantitative or scientific relationships in plain French prose. Use tables for numerical data when needed.';
  }
  if (lang === 'de') {
    return 'Do NOT use mathematical equations, formulas, symbolic notation, LaTeX-style expressions, or symbol-heavy representations (e.g. E=mc², ∑, ∫, √, α, β, Δ, H₀). Explain all quantitative or scientific relationships in plain German prose. Use tables for numerical data when needed.';
  }
  if (lang === 'hi') {
    return 'Do NOT use mathematical equations, formulas, symbolic notation, LaTeX-style expressions, or symbol-heavy representations (e.g. E=mc², ∑, ∫, √, α, β, Δ, H₀). Explain all quantitative or scientific relationships in plain Hindi prose. Use tables for numerical data when needed.';
  }
  return 'Do NOT use mathematical equations, formulas, symbolic notation, LaTeX-style expressions, or symbol-heavy representations (e.g. E=mc², ∑, ∫, √, α, β, Δ, H₀). Explain all quantitative or scientific relationships in plain English prose. Use tables for numerical data when needed.';
}

/** Strong one-line footer for long user prompts (subtopics, etc.). */
export function getUserPromptLanguageFooter(lang: OutputLanguage): string {
  if (lang === 'en') return '';
  if (lang === 'fr') {
    return `

Language: Write your entire response in French (all headings, labels, body text, and table content). For mid-unit wrap-ups, use French headings such as « Conclusion » or « Points clés » instead of English.`;
  }
  if (lang === 'de') {
    return `

Language: Write your entire response in German (all headings, labels, body text, and table content). For mid-unit wrap-ups, use German headings such as « Fazit » or « Kernpunkte » instead of English.`;
  }
  return `

Language: Write your entire response in Hindi — Devanagari script (all headings, labels, body text, and table content). For mid-unit wrap-ups, use Hindi headings such as « निष्कर्ष » or « मुख्य बिंदु » instead of English.`;
}

export function getUserPromptLanguageFooterShort(lang: OutputLanguage): string {
  if (lang === 'en') return '';
  if (lang === 'fr') {
    return `

Language: Write your entire response in French (all headings, labels, and body text).`;
  }
  if (lang === 'de') {
    return `

Language: Write your entire response in German (all headings, labels, and body text).`;
  }
  return `

Language: Write your entire response in Hindi (Devanagari) for all headings, labels, and body text.`;
}
