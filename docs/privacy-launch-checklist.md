# Privacy and data-use checks for the public site

SkillScope is deployed on Render. The `/privacy` page describes the current application code; check it against the deployed service after changes.

1. Arsen and `arsenbektemirov01@gmail.com` are on the page. Confirm whether a full legal name or entity and further disclosures are required in the operator's jurisdiction. Privacy notices may need the controller's identity, contact details, purposes, legal basis, recipients, retention and rights information. [GDPR Article 13](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679)
2. Render is the host. Check the workspace plan, log retention and any external log streams against [Render's logging documentation](https://render.com/docs/logging). Review processing locations, subprocessors and Render's data-processing terms, then add any necessary details to the public notice.
3. On the deployed URL, inspect network requests, response `Set-Cookie` headers, browser cookies and local storage. The current application code has no analytics or advertising scripts and writes local storage only after a visitor changes the theme or marks a skill. If tracking or other nonessential storage is added, assess consent before it runs and update the notice. [EDPB cookie guidance](https://www.edpb.europa.eu/sme/find-practical-info/faq_en), [ePrivacy Directive Article 5(3)](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32002L0058)
4. Review the public data bundle before each redeploy. It should contain derived aggregates, not raw vacancy descriptions, employer names, vacancy IDs or candidate information. Never upload the local raw-response or history files.
5. Resolve HeadHunter data-use rights separately. Its [API terms](https://hh.ru/article/15116) mention labour-market information in clause 3.3 but clauses 4.5–4.6 impose narrower limits on storage and sharing. Do not infer that a privacy notice, attribution, or a noncommercial label grants permission for a public derived-data product. Obtain a clear interpretation or permission for continued public use.

Recheck this list whenever hosting or tracking changes.
