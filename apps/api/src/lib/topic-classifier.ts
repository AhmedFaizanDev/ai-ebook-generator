/**
 * Classifies whether a given ebook topic is technical (requires code examples)
 * or non-technical (narrative, creative, humanistic — no code needed).
 *
 * Returns `true` for technical topics (programming, engineering, data science,
 * natural sciences, mathematics, etc.) and `false` for non-technical topics
 * (fiction, history, philosophy, social sciences, arts, etc.).
 */

const TECHNICAL_KEYWORDS: readonly string[] = [
  // Programming & Software
  'programming', 'coding', 'software', 'developer', 'development',
  'web development', 'app development', 'application development',
  'frontend', 'backend', 'full.?stack', 'api', 'rest api', 'graphql',
  'microservice', 'serverless', 'devops', 'ci.?cd', 'deployment',
  'version control', 'git', 'agile', 'scrum',

  // Languages
  'python', 'javascript', 'typescript', 'java\\b', 'kotlin', 'swift',
  'golang', '\\bgo\\b.*language', 'rust\\b', 'c\\+\\+', '\\bc#',
  'ruby', 'php', '\\bscala\\b', 'haskell', 'elixir', 'clojure',
  'assembly language', 'bash scripting', 'shell scripting', 'sql',

  // Computer Science
  'algorithm', 'data structure', 'operating system', 'computer science',
  'computer architecture', 'compiler', 'interpreter', 'runtime',
  'concurrency', 'parallelism', 'multithreading', 'async',
  'design pattern', 'object.oriented', 'functional programming',
  'memory management', 'garbage collection',

  // Data & AI
  'machine learning', 'deep learning', 'neural network', 'artificial intelligence',
  '\\bai\\b', '\\bml\\b', 'natural language processing', '\\bnlp\\b',
  'computer vision', 'data science', 'data engineering', 'data pipeline',
  'big data', 'analytics', 'data mining', 'feature engineering',
  'model training', 'llm', 'transformer model', 'reinforcement learning',

  // Infrastructure & Cloud
  'cloud computing', 'aws', 'azure', 'google cloud', '\\bgcp\\b',
  'docker', 'kubernetes', 'container', 'infrastructure', 'terraform',
  'ansible', 'networking', 'tcp.?ip', 'http', 'dns', 'load balancing',

  // Security & Systems
  'cybersecurity', 'cryptography', 'encryption', 'penetration testing',
  'ethical hacking', 'network security', 'vulnerability', 'firewall',
  'authentication', 'authorization', 'oauth', 'zero trust',

  // Database
  'database', 'relational database', 'nosql', 'mongodb', 'postgresql',
  'mysql', 'redis', 'elasticsearch', 'data warehouse', 'query optimization',

  // Engineering disciplines
  'mechanical engineering', 'electrical engineering', 'civil engineering',
  'chemical engineering', 'aerospace engineering', 'biomedical engineering',
  'control systems', 'signal processing', 'circuit', 'thermodynamics',
  'fluid dynamics', 'structural analysis', 'embedded systems',

  // Mathematics & Sciences
  'calculus', 'linear algebra', 'differential equation', 'statistics',
  'probability', 'number theory', 'discrete mathematics', 'topology',
  'quantum mechanics', 'quantum computing', 'physics', 'chemistry',
  'biochemistry', 'molecular biology', 'genetics', 'genomics',
  'bioinformatics', 'neuroscience', 'pharmacology',

  // Finance & Quant (technical application)
  'quantitative finance', 'algorithmic trading', 'financial modelling',
  'blockchain', 'cryptocurrency', 'smart contract', 'web3',
];

const TECHNICAL_PATTERN = new RegExp(
  TECHNICAL_KEYWORDS.join('|'),
  'i'
);

/**
 * Returns `true` if the topic is classified as technical; `false` otherwise.
 *
 * @param topic - The ebook topic string entered by the user.
 */
export function isTechnicalTopic(topic: string): boolean {
  return TECHNICAL_PATTERN.test(topic);
}
