# Roadmap

Planned improvements and ideas.

## In progress / near term

- **Rebind CLI** — Tool to process existing ebooks (PDF/DOCX): strip old cover, prepend new Cloud Nine cover + copyright, output to Drive. For bulk-updating already-generated books.
- **Sample output** — Add 1–2 example generated PDFs (e.g. in `sample-books/` or Drive) and link from README for proof and demos.

## Under consideration

- **Local / Ollama support** — Run models locally via [Ollama](https://ollama.ai) (Llama, Mistral, etc.) instead of OpenAI. No API key, no cloud cost; ideal for private or offline use. Would require an LLM provider abstraction (OpenAI-compatible or custom client).
- **More output formats** — EPUB, HTML bundle.
- **Configurable unit count** — e.g. 5 or 10 units via env or CSV.
- **Custom cover template** — Allow logo/theme override per batch or org.
- **Webhook / notification** — Optional callback or email when a batch run finishes (e.g. for long EC2 runs).

## Ideas (backlog)

- **Other local backends** — LM Studio, vLLM, or any OpenAI-compatible API. Same abstraction as Ollama; switch via env (e.g. `LLM_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://localhost:11434`).
- Optional **multi-language** generation (e.g. Hindi, Spanish) via prompt/model choice.
- **Templates** — Different book “styles” (technical vs. narrative, K–12 vs. higher ed).
- **API for third-party integrations** — Generate from external tools or LMS.

---

*Suggestions? Open an issue.*
