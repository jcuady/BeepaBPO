# Current First-Party Guidance

Search and AI-crawler behavior changes. At execution time, consult the current official documentation relevant to the target channels and record the access date in `docs/seo-ai-visibility.md`.

Start with:

- Google Search Central SEO Starter Guide: `https://developers.google.com/search/docs/fundamentals/seo-starter-guide`
- Google Search Central AI features: `https://developers.google.com/search/docs/appearance/ai-features`
- Google crawling, indexing, robots, canonicals, sitemaps, JavaScript SEO, and structured-data documentation under `https://developers.google.com/search/docs/`
- OpenAI crawler documentation: `https://developers.openai.com/bots/`
- Bing Webmaster Guidelines and IndexNow documentation when Bing is in scope.
- Schema.org vocabulary for semantic definitions, plus each search platform's supported-feature documentation for eligibility.

Prefer primary sources over SEO vendor claims. Current Google guidance says ordinary SEO fundamentals apply to its AI search features and no special AI file or schema is required. Current OpenAI documentation separates `OAI-SearchBot`, which supports ChatGPT search discovery, from `GPTBot`, which concerns potential model training. Reconfirm these names and behaviors before editing crawler policy.

Do not encode volatile performance thresholds or crawler IP ranges in the skill. Retrieve current values from the platform's official documentation and validate actual production behavior.
