# Table filters · November 7, 2026

Rankings and the Roster Builder player pool share conditional numeric filters.
Choose a category, operator (`=`, `!=`, `>`, `>=`, `<`, `<=`) and value. Multiple
conditions use either **Match all (AND)** or **Match any (OR)**. Clear conditions
restores the broader pool. Other existing filters still apply.

The comparisons use the current forecast, workload, park and grade view at full
precision, before sorting and pagination. Percentages use percentage points
(25 means 25%); AVG and OPS use decimal rates. IP uses decimal innings. Blank or
invalid conditions are inactive. Missing or inapplicable player values never
match, including `!=`. SD reference populations remain fixed. Rankings selection
and CSV exports use every matching row across all pages. Roster Builder filters
its available player pool; drafted players stay on their roster.

Filters save locally per account. Rankings JSON backups include numeric
conditions. Opening a custom list clears filters, consistent with the existing
list behavior.

## Entry-2027 rookies

The 40-man dropdown includes **2027 rookie-eligible · incl. NPB/MiLB-only**. This
is an eligibility filter independent of actual 40-man membership. It includes
eligible prior MLB call-ups as well as players without MLB appearances. Players
with exhausted eligibility are excluded even when their most recent season
began as a rookie. Classification is shared across hitting/pitching profiles.

The dated lookup uses official [MLB eligibility rules](https://www.mlb.com/glossary/rules/rookie-eligibility)
and [MLB Stats API](https://statsapi.mlb.com/api/v1/people) records through November
6, 2026. Career MLB AB and pitching outs check the 130-AB and 50-IP thresholds.
For players below both limits, regular-season active days are reconstructed from
activation/recall, option, injury and other roster transactions; more than 45
days exhausts eligibility. Injured-list days and postseason/offseason days are
excluded. September counts from 2020 onward. Official non-rookie seasons also
establish exhausted eligibility. These are derived classifications, not an MLB
certified eligibility list; ambiguous activation records use the MLB debut as
the observed active-date fallback. Unknown identities are excluded.

The complete current projection pool is covered, including its three NPB-only
pitcher identities. Rebuild scripts and the transaction-level audit are retained
in the analysis workspace: `deployment/fetch_rookie_filter.py`,
`deployment/fetch_rookie_transactions.py`, `deployment/build_rookie_filter.py`,
and `sessions/2026_11_07_atlas_filters/run_v1/rookie_eligibility_audit.json`.
Refresh this dated lookup when the source history or target season changes.

No projection methods, rates, workloads or default model were changed.
