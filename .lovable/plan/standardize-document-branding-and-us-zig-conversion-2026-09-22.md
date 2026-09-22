# Standardize document branding and US$/ZiG conversion

## What will change
- Put the MavingTech Business Solutions logo and official name on every generated or printable financial and academic document, including invoices, receipts, statements, finance reports, bank reconciliation, report cards, EMIS reports, marks reports, and lesson plans.
- Remove remaining legacy school names and old rand labels from generated documents.
- Show every financial amount as US dollars with its live ZiG equivalent, using the bursar-managed exchange rate.
- Add a reusable US$/ZiG converter to the finance area and the student and parent fee/subscription areas.
- Show live ZiG equivalents while parents enter invoice, fee, donation, and subscription payment amounts.
- Store the calculated ZiG value alongside USD when portal payments are recorded.

## Technical details
- Use the existing MBS print logo and shared document header helpers wherever possible.
- Extend the current exchange-rate hook so all converters update immediately when the bursar changes the rate.
- Keep USD as the source amount; ZiG remains derived from the active rate.
- Preserve existing payment rules, demo behavior, permissions, and stored USD values.

## Verification
- Check for remaining `R`, `ZAR`, `$`, legacy school names, and unbranded print generators.
- Verify the finance, student fees, parent billing/subscription, and online payment views.
- Verify generated document layouts and confirm the app builds without errors.
