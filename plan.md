## Statistics - Numeric todo counts in API summary

> Keep statistics API todo counts numeric when aggregate rows come back as strings from PostgreSQL.

- [x] Repository returns numeric todo counts when DB aggregate fields arrive as strings
- [x] Summary totals remain numeric across multiple work notes

## Test Reliability - PDF generation test network isolation

> Keep web tests deterministic by removing external CDN/network dependency in the PDF generation test.

- [ ] Mock/stub external font fetch in generate-work-note-pdf test so it passes without internet access
