# Optimization Recommendation Engine

Date: 2026-05-03

## Scope

Added a dry-run optimization engine for operations after initial setup.

Implemented:

- keyword bid-down recommendation candidates
- keyword bid-up recommendation candidates
- keyword watchlist recommendations
- ad group budget guardrail recommendations
- negative keyword staged recommendation
- UI panel for recommendation severity, trigger, action, impact, and automation level

## Safety

- Recommendations are generated from planner forecast data only.
- No Naver API write endpoint is called.
- All optimization actions stay as draft or staged recommendations.
- Pause/off remains the destructive-action substitute.

## Remaining Work

Connect real Naver performance sync and compare forecast against actual spend, clicks, conversions, CPA, and ROAS.
