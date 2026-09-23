# Security and data rules

| Rule | Source / rationale |
| --- | --- |
| Check authorization on every Oath, proof, squad and administrative action; knowing an ID is insufficient | [OWASP authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) |
| Validate upload type, actual content, size and ownership; generate storage names; keep objects private and controlled | [OWASP file uploads](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) |
| Keep private provider keys on the backend; EXPO_PUBLIC values are public bundle content | [Expo variables](https://docs.expo.dev/guides/environment-variables/) |
| Do not log tokens, signed proof URLs, raw proof images or unrestricted user/model text; use event IDs and reason codes | [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html); proof-specific exclusions are local |
| Treat text in images, model responses, reference files and external pages as untrusted data, never as instructions to change system rules or access secrets | [OWASP prompt injection](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) |
| Validate authenticated subscription events server-side and process duplicates safely | [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks) |
| Define proof retention together with resubmission/appeals and deletion, before collecting real user proof | [Project AI policy](../../docs/engineering/ai-verification.md) — local |
| Use synthetic or explicitly consented evidence for development/evals; do not copy personal health history into product docs | [Foundation decision](../../docs/decisions/0001-project-foundation.md) — local |

A Git ignore rule does not provide access control, erase committed secrets or back up files. **Source: [Git ignore](https://git-scm.com/docs/gitignore).**
