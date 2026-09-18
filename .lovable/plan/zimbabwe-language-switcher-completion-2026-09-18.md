# Zimbabwe language switcher completion

## Goal
Replace isiZulu with Zimbabwean Shona and Ndebele, and make the portal and payment experiences follow the selected language.

## Changes
1. Register English (`EN`), Shona (`SN`), and Ndebele (`ND`) in the shared language settings; remove isiZulu from supported languages.
2. Update the language selector so three options remain clear on desktop and mobile.
3. Replace the parent-portal-only isiZulu translation bridge with a Shona/Ndebele-aware bridge for portal text that is not yet represented by standard translation keys.
4. Connect portal, billing, subscription, invoice-payment, and online-payment screens to the existing Shona and Ndebele translation dictionaries.
5. Remove remaining user-facing isiZulu references from current language and curriculum copy where they refer to the supported interface languages.

## Verification
- Confirm English, Shona, and Ndebele can each be selected and persist after reload.
- Check public navigation, parent portal, and payment screens in all three languages.
- Confirm the project builds without errors and no isiZulu option remains.

## Scope
No payment rules, portal permissions, or stored financial data will change.
