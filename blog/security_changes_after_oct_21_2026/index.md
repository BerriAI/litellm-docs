---
slug: security-changes-after-oct-21-2026
title: "What we are changing after October 21"
date: 2026-10-30T10:00:00
authors:
  - oliver
  - krrish
  - ishaan
description: "Why the controls built after March did not stop the v1.107.0 release, and the identity, credential and detection changes we are making in response."
tags: [security, incident-report]
hide_table_of_contents: false
---

On October 21, 2026, our own release pipeline built, signed and published a malicious `litellm==1.107.0`. We published the [root cause analysis](/blog/security-incident-oct-21-2026-attack-chain) on October 23.

This post goes through what we learned and how we will prevent this from happening again. This includes - why the hardening we did after the March incident did not prevent this incident, what actually failed in October, and what we have changed and are committing to change.

{/* truncate */}

## Very different attacks

March and October look similar from the outside: a malicious LiteLLM package published through our own channels. However, the attacks took place through two substantially different surfaces, which is why the controls that we built after March did not prevent the October incident.

**March was a supply chain attack.** A compromised third-party dependency (Trivy, used unpinned in our CI security scanning) ran inside our CI. It read the static PyPI, GHCR and Docker release credentials we kept in environment variables and used them to publish malicious packages. The attacker never had access to our GitHub organization. They had control of a build step, which in turn had our keys.

![CI/CD v2 architecture: BerriAI/litellm runs security scans and unit tests in isolated environments, a manually triggered release runs from the private BerriAI/project-releaser repository, and CircleCI runs E2E tests on main and litellm_ pull requests](/img/blog/security_changes_after_oct_21_2026/ci_cd_v2_architecture.png)

We rebuilt the pipeline in response. [CI/CD v2](/blog/ci-cd-v2-improvements) isolated each stage, split validation and release into separate repositories, replaced static PyPI credentials with Trusted Publishing, signed container images with cosign, made release tags immutable, pinned every GitHub Action, and introduced automated scanning on every pull request. Our goal here was to keep untrusted code and long-lived credentials away from the release path.

**October was an infrastructure compromise.** No dependency was compromised, and the attacker did not get in through CI. The attack started with an administrative API key for an internal experimental service, which had been inadvertently committed to a public repository in May. That service in turn held the GitHub CLI OAuth token of one of our two organization owners. With that token, the attacker was an organization owner.

![October attack chain: a deleted commit exposed the LiteLLM Agent Platform master key, its GitHub token let the attacker run workflows that exfiltrated other PATs, the attacker pointed project_releaser at a poisoned fork, and the bad release was published to GHCR, Docker and PyPI](/img/blog/security_changes_after_oct_21_2026/october_attack_chain.png)

An organization owner has the ability to change almost anything in the GitHub organization, including pipeline code, branch protections, required checks, and the requirements on who approves what. The attacker pushed a change to our private release repository so the pipeline pulled source from their fork instead of `BerriAI/litellm`, pushed it past branch protection with the owner token, dispatched the pipeline, and approved the production gate with a second stolen token. Our pipeline, otherwise unchanged, built the fork, signed the images with our cosign key, and published everything with our Trusted Publisher identity.

| | March 2026 | October 2026 |
| --- | --- | --- |
| Entry point | Compromised dependency running in CI | Leaked API key for an internal experimental service |
| What the attacker held | Static release credentials from CI environment variables | An organization owner's GitHub token, and subsequently additional tokens exfiltrated via throwaway workflows |
| What the pipeline did | Nothing; the attacker published directly with stolen keys | Built, signed and published attacker-controlled source through the normal path |
| What the artifacts looked like | Unsigned, published outside the pipeline | Validly signed, valid Trusted Publishing provenance |
| What the March controls did | Built in response | Worked as designed, and significantly lessened the impact (e.g. existing release tags could not be overwritten). But could not fully prevent this attack. |

**The controls we introduced after the March incident are effective in defending against supply chain attacks.** Trusted Publishing and signing prove that an artifact came from our pipeline. The October incident does not call this into question: v1.107.0 did come from our pipeline - no pipeline controls can defend against an attacker who is an organization owner, because the owner owns the pipeline.

## What we're changing

You can find our analysis of the root cause of the incident [here](/blog/security-incident-oct-21-2026-attack-chain). The actions we are taking to address the primary factors that led to the incident span several categories.

### Identity and privilege

**No human day-to-day account is an owner.** Our GitHub enterprise and the release approval gate are held by a single dedicated account, associated only with a specific device in our office. That account is required to perform a release. Organization ownership for operational work is to be performed by dedicated owner accounts, separate from the accounts people use to write code. No owner account may authorize an OAuth application, or be used through the API or the `gh` CLI, and any token-based activity by an owner account raises an alert.

**Regular users can use agents. Regular users can never be owners or admins.** We are not going to tell engineers to stop using Claude Code and similar tools. Instead we size the account to the risk. Everything on a developer's machine should be assumed readable by the agents running on it, so an agent on a regular user's machine can do regular-user things and nothing more. The same rule applies to Google Workspace: administrative roles move to dedicated admin accounts, separated from daily use.

**Internal builds exist behind an identity-aware proxy.** Our experimental services are built fast, often with agent-heavy workflows. These systems should not be exposed to the Internet. All internal deployments now sit behind an identity-aware proxy.

**Phishing-resistant authentication everywhere.** Okta SSO (requiring phishing-resistant MFA) is already enforced on our GitHub organization. We are extending it to all internal systems and to user provisioning and deprovisioning, so that access is granted and removed in one place.

### Credentials

**Secret scanning and push protection on every repository.** This applies to the `BerriAI` organization and to `LiteLLM-Labs`, the organization where we put experimental projects.

**Ticketing key revocations.** The key that leaked in May and which subsequently resulted in the initial ingress on October 10th was not revoked. Secret scanning must open tickets automatically, and the ticket is only closed when revocation is confirmed.

**Automations never authenticate as a person.** Automations will authenticate as a GitHub App or with a fine-grained, expiring token with minimal scopes, enforced via periodic token audits. Moreover, GitHub CLI OAuth tokens are never to be used outside of their intended scope: authorizing the GitHub CLI on a developer's machine.

**Secrets available in protected branches only.** Repository-level secrets are moving into GitHub environments with deployment branch policies, so only workflows on protected branches can read them. While this would not have stopped the release, under the threat model of non-owner tokens being stolen, it would have stopped the exfiltration of additional tokens.

### Detection and response

**Deeper investment in monitoring and alerting.** GitHub audit logs for our organization now stream to Splunk, and alerting is in place. Alerts are now in place that trigger on all actions taken by the threat actor in GitHub. Further alerts are in development to trigger on policy violations and overrides which the threat actor did not specifically make use of, as well as anomaly detection such as unexpected geographic sources and impossible travel.

**Automatic release verification after shipping.** A verifier running outside GitHub will download every published wheel, sdist and image, will check out the corresponding tag from `BerriAI/litellm`, and compare contents. On any difference, it alerts a human and automatically yanks the releases.

**Increasing our security team.** We are looking for great security engineers to help us keep our community safe. If you're interested, please apply [here](https://jobs.ashbyhq.com/litellm/93705fde-0daa-49ce-94be-4551d3ac662d).

### The broader program

None of the following are relevant to the incident we just experienced, but are actions we are undertaking soon (or in some cases, have already begun) to improve our general security posture.

- **Chainguard Libraries for Python and Chainguard Catalog**, to source our dependencies and build images from a hardened, continuously rebuilt supply chain. This is a defense against the March class of attack (a compromised upstream dependency), not the October class.
- **Improvements in LiteLLM vulnerability posture**, by engaging with HackerOne for a managed vulnerability disclosure program and front-line triage, and engaging with Trail of Bits to harden the application code itself.
- **The LiteLLM Private Registry**, [announced on October 27](/blog/litellm-private-registry), will be used to deliver fixes for the most severe vulnerabilities ahead of public release. Note that the purpose of this registry is specifically for the distribution of embargoed vulnerability fixes, and does not represent a material security boundary with regard to releases.
- **A FIPS 140-3 compliant image** will be available in the near future for customers requiring FIPS-validated cryptographic operations.

## Commitments and dates

We will update this table in place as items complete, and say so when they do not.

| # | Commitment | Status | Target |
| --- | --- | --- | --- |
| 1 | Release approval held only by an account associated only with a specific physical device in our office | Complete | — |
| 2 | Dedicated GitHub owner accounts, separate from day-to-day accounts; no tokens, OAuth apps, API or `gh` use from any owner account | Complete | — |
| 3 | GitHub organization audit logs streaming to Splunk, with alerting | Complete | — |
| 4 | Alert on any token-based activity from an owner account | In progress | Nov 15, 2026 |
| 5 | Policy: regular users may use agents and tools; regular users may never be owners or admins | In progress | Nov 15, 2026 |
| 6 | Google Workspace superadministrator roles moved to dedicated admin accounts with associated alerting | Planned | Nov 15, 2026 |
| 7 | HackerOne managed vulnerability disclosure program with front-line triage live | In progress | Nov 15, 2026 |
| 8 | LiteLLM Private Registry in use for embargoed vulnerability fixes | In progress | Nov 15, 2026 |
| 9 | Okta SSO with phishing-resistant MFA for all internal systems, provisioning and deprovisioning (already enforced for all critical systems) | In progress | Nov 30, 2026 |
| 10 | Secret scanning and push protection on every repository in `BerriAI` and `LiteLLM-Labs` | In progress | Nov 30, 2026 |
| 11 | Ticketed revocation for every credential exposure; secret-scanning alerts open tickets automatically | Planned | Nov 30, 2026 |
| 12 | Identity-aware proxy in front of all internal deployments (already enforced for most systems) | In progress | Nov 30, 2026 |
| 13 | Alerts on every action the threat actor took in GitHub on October 10 | In progress | Nov 30, 2026 |
| 14 | Alerts on policy violations and overrides the threat actor did not make use of | In progress | Nov 30, 2026 |
| 15 | Chainguard Libraries for Python and Chainguard Catalog in use for dependencies and build images | In progress | Nov 30, 2026 |
| 16 | Trail of Bits application code hardening engagement, first round of fixes shipped | In progress | Nov 30, 2026 |
| 17 | Organization-level restrictions on third-party OAuth apps and approval required for fine-grained personal access tokens | Planned | Dec 31, 2026 |
| 18 | Enterprise-level rulesets protecting `main` and the release repository with no bypass actors | Planned | Dec 31, 2026 |
| 19 | Post-publish verifier, running outside GitHub, comparing PyPI wheels and sdist against the tag and alerting a human on mismatch | Planned | Dec 31, 2026 |
| 20 | Post-publish verifier extended to Docker Hub and GHCR images | Planned | Dec 31, 2026 |
| 21 | Automatic yank or tag removal on verifier mismatch | Planned | Dec 31, 2026 |
| 22 | Anomaly detection: unexpected geographic sources and impossible travel | Planned | Dec 31, 2026 |
| 23 | Two security hires: security engineer and security operations | In progress | Dec 31, 2026 |
| 24 | Automations that used human tokens stay off until rebuilt on GitHub Apps or scoped, expiring tokens | In progress | Jan 31, 2027 |
| 25 | Actions secrets moved from repository level into environments restricted to protected branches | Planned | Jan 31, 2027 |

## Reaching us

If you have questions about this post, or if there is any hardening you would like to see from us that is not on this list, please reach out to security@berri.ai. We will read every suggestion and weigh it carefully. We do not commit to adopting all suggestions, and where we decline we will try to say why, but the list above is not closed, and some of the best ideas for it will come from the people who run LiteLLM in production.

Oliver Jensen
Director of Security, LiteLLM
