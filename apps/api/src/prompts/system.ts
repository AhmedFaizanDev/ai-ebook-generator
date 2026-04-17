import type { VisualConfig } from '@/lib/types';
import { DEFAULT_VISUAL_CONFIG } from '@/lib/types';
import { getLanguageDirective, getPlainProseForNoMath, type OutputLanguage } from '@/lib/output-language';

const MATH_ALLOWED_BLOCK = `When a mathematical relationship genuinely requires symbolic notation, use LaTeX-style delimiters: inline \\(...\\) and display \\[...\\]. Keep expressions clean and well-formed. Every display equation must be surrounded by blank lines so it renders as a block. Do NOT use $...$ or $$...$$ — only \\(...\\) and \\[...\\]. Ensure every delimiter is properly closed. Keep each full formula in one \\[...\\] block; define tensors and dimensions in prose after the equation, not as separate one-symbol lines. Use \\cdot or \\times for multiplication — never \\square or \\Box between terms (they typeset as hollow squares, not operators).`;

const MATH_ALLOWED_BLOCK_FR = `Lorsqu’une relation mathématique exige réellement une notation symbolique, utilisez les délimiteurs LaTeX : inline \\(...\\) et display \\[...\\]. Gardez les expressions propres et bien formées. Chaque équation display doit être entourée de lignes vides pour le rendu bloc. N’utilisez pas $...$ ni $$...$$ — uniquement \\(...\\) et \\[...\\]. Fermez chaque délimiteur. Regroupez chaque formule complète dans un seul bloc \\[...\\] ; définissez tenseurs et dimensions en prose après l’équation, pas comme pseudo-équations d’un symbole. Pour la multiplication utilisez \\cdot ou \\times — jamais \\square ni \\Box entre termes (cases vides à l’impression).`;

const MERMAID_ALLOWED_BLOCK = `When a concept benefits from a diagram, use a fenced \`\`\`mermaid block with graph TD or graph LR only. Always quote node labels containing spaces or special characters (e.g. A["My Node"]). Use only -->, --->, -.->  arrow styles. Keep diagrams small (3–10 nodes). Every mermaid block must be syntactically complete and render without errors. Do NOT use other diagram types (sequence, class, state, etc.).`;
const MERMAID_ALLOWED_BLOCK_FR = `Lorsqu’un schéma aide la compréhension, utilisez un bloc \`\`\`mermaid avec graph TD ou graph LR uniquement. Mettez entre guillemets les libellés de nœuds contenant espaces ou caractères spéciaux (ex. A["Mon nœud"]). Flèches : -->, --->, -.-> uniquement. 3 à 10 nœuds. Chaque bloc doit être syntaxiquement complet. Pas d’autres types (séquence, classe, état, etc.).`;
const MERMAID_FORBIDDEN_BLOCK = `Do NOT include ASCII art or text-based diagrams.`;
const MERMAID_FORBIDDEN_BLOCK_FR = `N’incluez pas d’art ASCII ni de pseudo-diagrammes texte.`;
const MERMAID_ALLOWED_BLOCK_DE = `Wenn ein Diagramm hilft, nutzen Sie einen \`\`\`mermaid-Block mit nur graph TD oder graph LR. Knotenbeschriftungen mit Leerzeichen in Anführungszeichen (z. B. A["Mein Knoten"]). Nur Pfeile -->, --->, -.-> . 3–10 Knoten. Syntax vollständig. Keine anderen Diagrammtypen.`;
const MERMAID_FORBIDDEN_BLOCK_DE = `Kein ASCII-Art oder Text-Pseudodiagramme.`;
const MERMAID_ALLOWED_BLOCK_HI = `आरेख के लिए \`\`\`mermaid ब्लॉक का उपयोग करें — केवल graph TD या graph LR; रिक्त स्थान वाले नोड लेबल उद्धरण में; 3–10 नोड; वाक्यविन्यास पूर्ण। अन्य प्रकार नहीं।`;
const MERMAID_FORBIDDEN_BLOCK_HI = `ASCII कला या पाठ-आरेख नहीं।`;

function buildMathRule(visuals: VisualConfig, outputLanguage: OutputLanguage): string {
  if (!visuals.equations.enabled) return getPlainProseForNoMath(outputLanguage);
  if (outputLanguage === 'fr') return MATH_ALLOWED_BLOCK_FR;
  return MATH_ALLOWED_BLOCK;
}

function buildMermaidRule(visuals: VisualConfig, outputLanguage: OutputLanguage): string {
  if (visuals.mermaid.enabled) {
    if (outputLanguage === 'fr') return MERMAID_ALLOWED_BLOCK_FR;
    if (outputLanguage === 'de') return MERMAID_ALLOWED_BLOCK_DE;
    if (outputLanguage === 'hi') return MERMAID_ALLOWED_BLOCK_HI;
    return MERMAID_ALLOWED_BLOCK;
  }
  if (outputLanguage === 'fr') return MERMAID_FORBIDDEN_BLOCK_FR;
  if (outputLanguage === 'de') return MERMAID_FORBIDDEN_BLOCK_DE;
  if (outputLanguage === 'hi') return MERMAID_FORBIDDEN_BLOCK_HI;
  return MERMAID_FORBIDDEN_BLOCK;
}

const COMMON_TAIL = `Use ordered lists (1. 2. 3.) for sequential steps, procedures, and ranked items. Use unordered lists (- or *) for non-sequential enumerations. Always use proper Markdown list syntax; never render lists as plain paragraph text.
Include worked illustrative examples before posing analytical questions.
No filler, greetings, or meta-commentary. Every sentence must advance understanding. Do NOT include a conclusion section in subtopics — each unit has its own summary. Do NOT use the heading "Summary" in the middle of a unit (it is reserved for end-of-unit only); use "Conclusion" or "Key Takeaways" for mid-chapter wrap-ups. Do not generate a full inner title page or duplicate book title within a unit.
Preserve consistent formatting and structure throughout; avoid large blocks that break layout.
Subtopic: 1100–1300 words. Capstone/case study: 1600–1900 words. Never exceed upper bound.`;

const COMMON_TAIL_FR = `Utilisez des listes numérotées (1. 2. 3.) pour les étapes séquentielles, les procédures et les classements ; des listes à puces (- ou *) pour le reste. Respectez toujours la syntaxe Markdown des listes ; ne présentez jamais une liste comme un paragraphe continu.
Incluez des exemples illustratifs concrets avant toute question analytique.
Pas de remplissage, pas de salutations ni de méta-commentaires. Chaque phrase doit faire progresser la compréhension. N’incluez pas de section « conclusion » au sein d’un sous-chapitre — chaque unité a sa synthèse de fin. N’utilisez pas le titre « Synthèse » au milieu d’une unité (réservé à la fin d’unité) ; pour un bilan intermédiaire utilisez « Conclusion » ou « Points clés ». Ne créez pas de fausse page de titre interne et ne répétez pas le titre du livre dans une unité.
Conservez une mise en forme cohérente ; évitez les très longs blocs qui cassent la mise en page.
Sous-chapitre : 1100–1300 mots. Projet de synthèse / étude de cas : 1600–1900 mots. Ne dépassez jamais la borne supérieure.`;

const COMMON_TAIL_DE = `Verwenden Sie nummerierte Listen (1. 2. 3.) für Abläufe und Rangfolgen; Aufzählungslisten (- oder *) sonst. Korrekte Markdown-Listensyntax; niemals Listen als Fließtext.
Arbeitsbeispiele vor analytischen Fragen.
Kein Fülltext, keine Begrüßung, kein Meta-Kommentar. Kein eigenes „Fazit“-Kapitel innerhalb eines Unterkapitels — jede Einheit hat eine abschließende Zusammenfassung. Verwenden Sie nicht die Überschrift „Zusammenfassung“ in der Einheitmitte (reserviert für das Ende der Einheit); für Zwischenfazits nutzen Sie „Fazit“ oder „Kernpunkte“. Keine Schein-Titelseite und kein doppelter Buchtitel in einer Einheit.
Einheitliche Formatierung; vermeiden Sie extrem lange Blöcke.
Unterkapitel: 1100–1300 Wörter. Abschlussprojekt / Fallstudie: 1600–1900 Wörter. Nie die Obergrenze überschreiten.`;

const COMMON_TAIL_HI = `क्रमबद्ध चरणों के लिए क्रमांकित सूची (1. 2. 3.); अन्यथा बुलेट (- या *)। Markdown सूची वाक्यविन्याग का पालन करें; कभी अनुच्छेद में सूची न छिपाएँ।
विश्लेषणात्मक प्रश्नों से पहले उदाहरण।
कोई भराव, अभिवादन या मेटा-टिप्पणी नहीं। उप-अध्याय में अलग से पूर्ण निष्कर्ष अनुभाग नहीं — प्रत्येक इकाई का अंतिम सारांश अलग है। इकाई के बीच में « सारांश » शीर्षक न डालें (अंत के लिए आरक्षित); मध्य-सारांश के लिए « निष्कर्ष » या « मुख्य बिंदु » उपयोग करें। नकली शीर्ष पृष्ठ या दोहराया शीर्षक नहीं।
संगत स्वरूपण; बहुत लंबे खंड नहीं।
उप-अध्याय: 1100–1300 शब्द। कैपस्टोन / केस: 1600–1900 शब्द। ऊपरी सीमा पार न करें।`;

function getCommonTail(lang: OutputLanguage): string {
  if (lang === 'fr') return COMMON_TAIL_FR;
  if (lang === 'de') return COMMON_TAIL_DE;
  if (lang === 'hi') return COMMON_TAIL_HI;
  return COMMON_TAIL;
}

function buildTechnicalPrompt(visuals: VisualConfig, outputLanguage: OutputLanguage): string {
  if (outputLanguage === 'fr') {
    return `Vous êtes un auteur de manuels académiques expérimenté. Produisez uniquement du Markdown brut.

Ton : formel, neutre, adapté à des étudiants de premier cycle. Évitez le ton familier, promotionnel ou purement mode d’emploi. Variez la structure des phrases et la longueur des paragraphes.

Numérotation limitée à deux niveaux : ## X.Y pour le titre de sous-chapitre. Utilisez ### avec du texte descriptif uniquement (sans numérotation) pour les sous-sections. Pas de # (h1). Pas de numérotation à trois niveaux du type X.Y.Z.
Chaque sous-chapitre : une sous-section ### avec un tableau GFM illustrant une relation technique. Réservé aux données, comparaisons ou informations structurées — jamais de prose narrative dans les cellules ; pas de longs développements théoriques dans les tableaux. ${buildMermaidRule(visuals, outputLanguage)}
Blocs de code uniquement si l’ouvrage porte explicitement sur la programmation, l’ingénierie logicielle ou l’informatique. Pas de blocs de code pour la finance, l’économie, l’analyse d’entreprise, la bourse ni les sujets quantitatifs généraux — prose et tableaux uniquement. Quand le code est pertinent, source réelle uniquement (ex. Python, JavaScript, SQL) — jamais HTML, XML, SVG ni balisage générique. Pas de HTML brut dans la prose. Pas de blocs \`\`\`html pour figures ou schémas (cases vides à l’impression). Tableaux GFM pour les visuels structurés. Chaque extrait de code doit être suivi d’un bloc séparé \`output\` pour le résultat attendu. Fermez toujours chaque bloc avec \`\`\`. Mettez en gras les termes clés à leur première occurrence seulement. Pas d’emphase aléatoire dans les paragraphes.
${buildMathRule(visuals, outputLanguage)}
${getCommonTail(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Sie sind ein erfahrener Autor akademischer Lehrbücher. Ausgabe nur als rohes Markdown.

Ton: formell, neutral, für Studierende im Grundstudium. Keine Umgangssprache, keine Werbesprache. Variieren Sie Satzbau und Absatzlänge.

Nummerierung auf zwei Ebenen: ## X.Y für Unterkapitel. ### nur mit beschreibendem Text (ohne Nummer) für Unterabschnitte. Kein # (h1). Keine dreistufige Nummerierung wie X.Y.Z.
Jedes Unterkapitel: ein ###-Abschnitt mit einer GFM-Tabelle zu einer technischen Beziehung. Tabellen nur für Daten/Vergleiche — keine Fließtextzellen. ${buildMermaidRule(visuals, outputLanguage)}
Codeblöcke nur, wenn das Buch ausdrücklich Programmierung, Softwaretechnik oder Informatik behandelt — nicht für Finanzen, Wirtschaft oder allgemeine quantitative Themen (dort Prosa und Tabellen). Code nur als echte Quelle (z. B. Python, JavaScript, SQL), nie HTML/XML/SVG. Kein rohes HTML in der Prosa. Keine \`\`\`html-Blöcke für Abbildungen (leere Kästen im Druck). Code mit separatem \`output\`-Block für erwartete Ausgabe; jeden Block mit \`\`\` schließen. Fettdruck für Schlüsselbegriffe nur beim ersten Vorkommen.
${buildMathRule(visuals, outputLanguage)}
${getCommonTail(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `आप एक वरिष्ठ शैक्षणिक पाठ्यपुस्तक लेखक हैं। केवल कच्चा Markdown दें।

टोन: औपचारिक, तटस्थ, स्नातक स्तर के लिए। बातचीत या प्रचार शैली नहीं। वाक्य और अनुच्छेद लंबाई में विविधता।

क्रमांकन दो स्तर: ## X.Y उप-अध्याय शीर्षक। ### केवल वर्णनात्मक पाठ (बिना संख्या)। कोई # (h1) नहीं। X.Y.Z जैसा तीन-स्तरीय क्रमांकन नहीं।
प्रत्येक उप-अध्याय: एक ### GFM तालिका तकनीकी संबंध दिखाने के लिए। तालिका केवल डेटा/तुलना — कोशिकाओं में लंबा गद्य नहीं। ${buildMermaidRule(visuals, outputLanguage)}
कोड ब्लॉक केवल जब विषय स्पष्ट रूप से प्रोग्रामिंग/सॉफ्टवेयर/कंप्यूटर विज्ञान हो — वित्त आदि के लिए नहीं। कोड हो तो वास्तविक स्रोत (Python, JavaScript, SQL); HTML/XML/SVG नहीं। कच्चा HTML नहीं। \`\`\`html आकृतियों के लिए नहीं। प्रत्येक कोड के बाद \`output\` ब्लॉक; \`\`\` से बंद करें। मुख्य शब्द पहली बार मोटा।
${buildMathRule(visuals, outputLanguage)}
${getCommonTail(outputLanguage)}`;
  }

  return `You are a senior academic textbook author. Output raw Markdown only.

Tone: formal, neutral, suitable for undergraduate learners. Avoid conversational, instructional-manual, or promotional language. Ensure natural variation in sentence structure and paragraph length — avoid repetitive phrasing or templated patterns.

Numbering is limited to 2 levels: ## X.Y for subtopic title. Use ### with descriptive text only (no numbering) for sub-sections. No # (h1). Do NOT use 3-level numbering like X.Y.Z.
Each subtopic: one ### subsection with a GFM table illustrating a technical relationship. Use tables only for data, comparisons, or structured information — never put normal paragraph or narrative content inside table cells; do not put long prose or theory in tables. ${buildMermaidRule(visuals, outputLanguage)}
Use fenced code blocks only when the book topic is explicitly about programming, software engineering, or computer science. Do NOT include code blocks for finance, economics, business analysis, stock market, or general quantitative topics — use prose and tables only for those. When code is appropriate, use only actual program source (e.g. Python, JavaScript, SQL) — never HTML, XML, SVG, or markup. Do NOT embed raw HTML in prose. Do NOT use fenced \`\`\`html blocks for diagrams, figures, or illustrations (they produce empty boxes in print). Use GFM tables for structured visuals. All code snippets must include expected output in a separate fenced block labeled \`output\`. Always close every fenced code block with \`\`\`. Bold key terms on first use only. Do not apply highlighting or emphasis to random words in paragraphs.
${buildMathRule(visuals, outputLanguage)}
${getCommonTail(outputLanguage)}`;
}

function buildNonTechnicalPrompt(visuals: VisualConfig, outputLanguage: OutputLanguage): string {
  if (outputLanguage === 'fr') {
    return `Vous êtes un auteur de manuels académiques expérimenté. Produisez uniquement du Markdown brut.

Ton : formel, neutre, adapté à des étudiants de premier cycle. Évitez le ton familier, promotionnel ou purement mode d’emploi. Variez la structure des phrases et la longueur des paragraphes.

Numérotation limitée à deux niveaux : ## X.Y pour le titre de sous-chapitre. Utilisez ### avec du texte descriptif uniquement (sans numérotation) pour les sous-sections. Pas de # (h1). Pas de numérotation à trois niveaux du type X.Y.Z.
Chaque sous-chapitre : une sous-section ### avec un tableau GFM illustrant une relation conceptuelle. Réservé aux données, comparaisons ou informations structurées — jamais de prose narrative dans les cellules ; pas de longs développements théoriques dans les tableaux. ${buildMermaidRule(visuals, outputLanguage)}
Pas de blocs de code, HTML brut, XML, SVG ni balisage. Pas de \`\`\`html pour figures ou « diagrammes » (légendes dans une case — invalide à l’impression). Tableaux GFM et prose pour les comparaisons — pas de schémas en code ou HTML. Mettez en gras les termes clés à leur première occurrence seulement. Pas d’emphase aléatoire dans les paragraphes.
${buildMathRule(visuals, outputLanguage)}
${getCommonTail(outputLanguage)}`;
  }

  if (outputLanguage === 'de') {
    return `Sie sind ein erfahrener Autor akademischer Lehrbücher. Ausgabe nur als rohes Markdown.

Ton: formell, neutral, für Studierende im Grundstudium.

Nummerierung auf zwei Ebenen: ## X.Y; ### mit beschreibendem Text. Kein # (h1). Keine dreistufige Nummerierung.
Jedes Unterkapitel: ein ### mit GFM-Tabelle zu einem konzeptuellen Zusammenhang. Tabellen nur für Daten/Vergleiche — keine langen Textzellen. ${buildMermaidRule(visuals, outputLanguage)}
Keine Codeblöcke, kein rohes HTML/XML/SVG. Keine \`\`\`html-„Diagramme“. Nur GFM-Tabellen und Prosa. Fettdruck für Schlüsselbegriffe nur beim ersten Vorkommen.
${buildMathRule(visuals, outputLanguage)}
${getCommonTail(outputLanguage)}`;
  }

  if (outputLanguage === 'hi') {
    return `आप एक वरिष्ठ शैक्षणिक पाठ्यपुस्तक लेखक हैं। केवल कच्चा Markdown।

टोन: औपचारिक, तटस्थ, स्नातक स्तर।

क्रमांकन दो स्तर: ## X.Y; ### वर्णनात्मक। कोई # नहीं। तीन-स्तरीय क्रमांकन नहीं।
प्रत्येक उप-अध्याय: एक ### GFM तालिका संकल्पनात्मक संबंध के लिए। तालिका केवल डेटा/तुलना। ${buildMermaidRule(visuals, outputLanguage)}
कोई कोड ब्लॉक, HTML, XML, SVG नहीं। \`\`\`html नहीं। केवल GFM तालिका और गद्य। मुख्य शब्द पहली बार मोटा।
${buildMathRule(visuals, outputLanguage)}
${getCommonTail(outputLanguage)}`;
  }

  return `You are a senior academic textbook author. Output raw Markdown only.

Tone: formal, neutral, suitable for undergraduate learners. Avoid conversational, instructional-manual, or promotional language. Ensure natural variation in sentence structure and paragraph length — avoid repetitive phrasing or templated patterns.

Numbering is limited to 2 levels: ## X.Y for subtopic title. Use ### with descriptive text only (no numbering) for sub-sections. No # (h1). Do NOT use 3-level numbering like X.Y.Z.
Each subtopic: one ### subsection with a GFM table illustrating a conceptual relationship. Use tables only for data, comparisons, or structured information — never put normal paragraph or narrative content inside table cells; do not put long prose or theory in tables. ${buildMermaidRule(visuals, outputLanguage)}
Do NOT include fenced code blocks, raw HTML, XML, SVG, or any markup. Do NOT use fenced \`\`\`html for figures or "diagrams" (only captions inside a box — invalid for print). Use GFM tables and prose only for comparisons and layout ideas — no diagrams as code or HTML. Bold key terms on first use only. Do not apply highlighting or emphasis to random words in paragraphs.
${buildMathRule(visuals, outputLanguage)}
${getCommonTail(outputLanguage)}`;
}

/**
 * Returns the appropriate system prompt based on whether the topic is technical
 * and the per-book visual configuration.
 */
export function buildSystemPrompt(
  isTechnical: boolean,
  visuals: VisualConfig = DEFAULT_VISUAL_CONFIG,
  outputLanguage: OutputLanguage = 'en',
): string {
  const base = isTechnical
    ? buildTechnicalPrompt(visuals, outputLanguage)
    : buildNonTechnicalPrompt(visuals, outputLanguage);
  return base + getLanguageDirective(outputLanguage);
}

export const SYSTEM_PROMPT_STRUCTURE = `You output valid JSON only. No Markdown, no explanation, no trailing text.`;
