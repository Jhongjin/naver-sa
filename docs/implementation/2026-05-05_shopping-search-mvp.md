# Shopping Search MVP

## Summary

Added Shopping Search as a selectable setup product beside Powerlink / Site Search Ads.

The MVP remains approval-first and live-off. Shopping Search support focuses on planning, account inventory lookup, product-group selection, and staged payload generation.

## Implemented

- `productType` on planner input: `powerlink` or `shoppingSearch`
- Korean UI product switch: `파워링크` / `쇼핑검색`
- Shopping Search-specific labels for search query CSV, channel fields, and setup copy
- Shopping Search staged changes:
  - campaign creation draft
  - shopping channel / product group scan requirement
  - shopping ad group creation drafts
  - product query mapping draft
- Read-only product group lookup through `GET /ncc/product-groups`
- Account snapshot response now includes normalized product groups
- Shopping Search execution draft:
  - `campaignTp: "SHOPPING"`
  - `adgroupType: "SHOPPING"`
  - `nccBusinessChannelId`
  - `nccProductGroupId`
- Missing shopping channel or product group IDs remain validation blockers before protected test execution.

## Policy Notes

Naver Search Ad release notes state that product groups are linked to shopping mall inventory and can be connected to multiple ad groups. Product groups cannot be registered through the API; registered product groups can be queried using `GET /api/ncc/product-groups`.

Source: https://naver.github.io/searchad-apidoc/release/2021/03/17/release-note/

The same release notes show shopping-brand ad group creation requiring an existing `nccProductGroupId`. The MVP therefore treats product-group selection as a required precondition before protected Shopping Search test execution.

## Not Implemented

- Product group creation
- Shopping product/feed mutation
- Shopping Brand creative automation
- Live Shopping Search activation
- Performance/stat sync for Shopping Search

## Validation

- Planner preview creates Shopping Search-specific staged changes.
- Stage draft with approved changes and sample shopping IDs generates `SHOPPING` campaign/ad group payloads.
- Lint and production build pass.
