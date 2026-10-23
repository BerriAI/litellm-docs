---
slug: security-incident-oct-21-2026-attack-chain
title: "The attack chain behind the Oct 21, 2026 release compromise"
date: 2026-10-23T10:00:00
authors:
  - mateo
  - oliver
description: "How a master key committed to a public repository in May led to three stolen GitHub tokens and the compromised litellm v1.107.0 release, step by step."
tags: [security, incident-report]
hide_table_of_contents: false
---

On October 21, our release pipeline published a compromised `litellm==1.107.0` to PyPI and to our container registries. The [incident post](/blog/security-incident-oct-21-2026) covers the affected artifacts and what to do if you ran them. We have completed our investigation into the actions taken by the threat actor, and can confidently assert the timeline and sequence of events that led to the publication of the malicious `v1.107.0` release.

We posted regular status updates during our investigation yesterday reflecting the scenario to the best of our knowledge as the investigation proceeded. The investigation was a process in which we continually learned additional information, meaning some of our assumptions and beliefs were later proven to be inaccurate or incomplete. This post should be considered the canonical source of truth where the status updates and the narrative below disagree.


{/* truncate */}


## Narrative

On May 27, 2026, a configuration file [was committed](https://github.com/LiteLLM-Labs/lite-harness/blob/e10b14a/harnesses/opencode/opencode.json) to the public `LiteLLM-Labs/lite-harness` repository which inadvertently contained the master key to a deployment of the LiteLLM Agent Platform, an open source tool we use for orchestrating agents. The error was quickly identified, the commit force-pushed over, and we identified the key as requiring revocation. However, key revocation did not occur.

### GitHub Owner Access

We use the LiteLLM Agent Platform internally to trigger automated pull requests to the LiteLLM repository for model price updates, which are then human-reviewed and merged. In order to create PRs, the system was configured with a GitHub authentication token. The token in question was not associated with a service account and was not scoped down. The key used was a GitHub CLI OAuth token associated with our GitHub organization owner's account.

On October 10th, the threat actor used this key to gain access to our LiteLLM Agent Platform and extracted this GitHub CLI OAuth token. From this point onwards, the threat actor had owner-level access to all repositories in our GitHub. GitHub CLI tokens are post-2fa and not subject to GitHub's "super-user" 2fa reauth flows associated with sensitive organization or repository actions.

### Exfiltrating additional tokens

Using the access provided by this token, the threat actor began to perform additional credential exfiltration actions. They authored comits into branches on internal repositories to execute workflows designed to exfiltrate any tokens and secrets configured to be available to CI in our repositories. In so doing, they acquired similar GitHub CLI Oauth tokens associated with two engineers with maintainer privileges.

They also acquired tokens to several other internal systems. Reviewing the actor's activity on these other systems shows attempts to identify and exfiltrate additional keys and tokens, with a primary focus on upstream inference API tokens.

While we have traced out all tokens we believe the threat actor could have accessed, we are revoking every token associated with every internal system and vendor platform. This incident has provided a strong illustration of the risks associated with failing to rotate a potentially exposed key.

### Building and Signing the Malicious Release

Having access to multiple GitHub identities, the threat actor was now in a position to be able to make changes to our repositories without being overly noisy, concealing changes within proper-seeming proposals and approvals. The threat actor began by attempting to subvert our project releaser repository to have it pull the package from a different (malicious) repository. They were unable to get approval to merge due to heavily restricted approvals on the repository. As such, they opted to for the noisier approach of using the org owner's token to bypass and disable restrictions on the repository, pushing the change.

In typical operation, building and publishing a release requires being kicked off by an authorized engineer and being approved by a special account locked to a physical device in our office. This restriction was relaxed earlier this week to accommodate the temporary push for more frequent releases and bugfix backports, allowing any two engineers to trigger and approve a release. As such, the threat actor used one of the tokens to trigger the release (after having repointed the deployer to their malicious repository), and another to approve it.

It is worth noting, however, that armed with a token belonging to an organization owner, the threat actor could very well have relaxed this restriction (or removed it entirely) themselves. However, we believe they used the separate tokens in order to evade detection by way of noisy audit logs.

### Aftermath and Containent

The malicious releases were published to our public registries at around 4:40 AM PDT (11:40 UTC). We became aware of the malicious releases shortly before 6 AM (13:00 UTC) and immediately began the process to remove them. The PyPi releases were frozen by 6:23 AM PDT (13:23 UTC). The Docker images took us a bit longer as we worked to wake the inviduals with access to our Docker registry, and were removed by 7:20 AM PDT (14:20 UTC).

In response, at the beginning of our investigation, we took the following temporary mitigation approaches:
* We immediately locked our public registries to prevent additional images from being published.
* As soon as we suspected GitHub accounts were compromised, we removed *all* members from our GitHub organization, with the exception of a single specific account temporarily promoted to owner which we could be confident was not affected.
* We began operating in a mode which assumes that every possible token, key, or authenticator belonging to our organization was exfiltrated.

As investigations began to shed light on the scope and details of the attack, we were able to begin laying out a roadmap necessary for secure account and process reinstatement.

At this point, we are confident in our ability to safely issue a release by EOD today, and can finally provide our users with a fix for removing the eMudhra certificate authority from our trust store. We understand it has been frustrating that we have been slow to issue a release to remediate this high-profile issue. We will only issue releases when we can be confident in their safety.

### Process Improvements

We know many of you want to hear what we’ve learned and what we’re changing. We’ll share that next week. Incidents like this create pressure to announce sweeping changes immediately, but we’d rather take a few days to understand where the real failures were, and why we didn’t detect this sooner, than commit to fixes that address the wrong problems. In the meantime, we didn’t want to hold back the investigation itself.


## Timeline

### Major Event Summary

| Step | Credential | How the attacker got it | What it was used for |
|---|---|---|---|
| 0 | Master key of the LiteLLM Agent Platform, an internal alpha service | Committed to a public repository on May 27 | Reading the Agent Platform API |
| 1 | GitHub CLI token of a GitHub organization owner | Returned by the Agent Platform API on October 10 | Pushing the exfiltration branches, changing the release workflow, running the staging build, force-pushing the cover-up |
| 2 | GitHub CLI token of a second maintainer, stored as the `GH_TOKEN` secret of `BerriAI/litellm` | Posted to the attacker's endpoint by a throwaway workflow on October 10 | Approving the production gate |
| 3 | GitHub CLI token of a third maintainer, stored as the `RELEASE_PLEASE_TOKEN` secret of `BerriAI/litellm-auto` | Posted to the same endpoint by a second throwaway workflow on October 10 | Deleting the release run records |

Our first post suspected the tokens were taken from the logs of an internal LiteLLM deployment. The request logs show the first token came from a different service, described in step 1.

## Detailed Timeline

All times in UTC.

| Time (UTC) | Step | Credential | Event |
|---|---|---|---|
| May 27, 18:53:14 | 0 | none | `opencode.json` with the Agent Platform master key is committed to the public `LiteLLM-Labs/lite-harness` repository |
| Oct 10, 21:13 to 21:28 | 1 | Master key | The attacker calls the Agent Platform API from `69.48.229.143` |
| Oct 10, 21:27:10 | 1 | Master key | `GET /api/v1/managed_agents/agents?limit=100` returns the owner's GitHub CLI token |
| Oct 10, 22:11:45 | 2 | Owner's token | Workflow run on branch `ci-tmp-a351cc` of `BerriAI/litellm` posts six secrets, `GH_TOKEN` among them, to `webhook.site` |
| Oct 10, 22:12:09 | 3 | Owner's token | Workflow run on branch `ci-tmp-be33e9` of `BerriAI/litellm-auto` posts `RELEASE_PLEASE_TOKEN` to the same endpoint |
| Oct 10, 22:14:14 | 2 | Owner's token | The `BerriAI/litellm` run is deleted |
| Oct 10, 22:14:31 | 3 | Owner's token | The `BerriAI/litellm-auto` run is deleted |
| Oct 21, 10:08:29 | 4 | Second maintainer's token | Push of commit `9cf97e9` to `main` of `BerriAI/project-releaser` is rejected by branch protection |
| Oct 21, 10:08:34 | 4 | Owner's token | The same push succeeds by overriding branch protection |
| Oct 21, 10:46:39 | 4 | Owner's token | Staging workflow dispatched with the source set to the lookalike `Berri-AI/litellm` at commit `20535d8f` |
| Oct 21, 11:08:09 | 4 | none | Staging run finishes |
| Oct 21, 11:08:53 | 4 | none | Production release pipeline starts |
| Oct 21, 11:11:18 | 5 | Second maintainer's token | Production environment gate approved from `199.91.221.39` |
| Oct 21, 11:39:51 to 11:40:13 | 5 | none | Seven `litellm==1.107.0` wheels are published to PyPI |
| Oct 21, 11:46:56 | 5 | none | Docker Hub and GHCR images are published |
| Oct 21, 11:53:49 | 6 | Third maintainer's token | Production run record deleted |
| Oct 21, 11:54:01 | 6 | Third maintainer's token | Staging run record deleted |
| Oct 21, 12:09:38 | 7 | Owner's token | Revert commit `285fbdc5` pushed to `main` by overriding branch protection |
| Oct 21, 12:24:52 | 7 | Owner's token | `main` force-pushed back to `d687b69`, overriding the force-push block |


## Annotated Events


### Step 1: the master key returns a GitHub token (October 10, 21:13 to 21:28)

From `69.48.229.143`, the attacker called the Agent Platform API with the master key.

1. Between 21:13 and 21:28 the attacker made a series of authenticated requests to the API.
2. At 21:27:10 a request to `GET /api/v1/managed_agents/agents?limit=100` returned the configuration of every managed agent.
3. That response contained the GitHub CLI OAuth token of one of our two GitHub organization owners.

### Step 2: a throwaway branch exfiltrates the CI secrets of BerriAI/litellm (October 10, 22:11)

With the owner's token, the attacker turned a repository's own CI into the exfiltration channel.

1. The attacker pushed commit `b69bc36` on a branch named `ci-tmp-a351cc` to `BerriAI/litellm`.
2. Its workflow run started at 22:11:45 and posted six repository secrets to an attacker-controlled `webhook.site` endpoint.
3. One of them, `GH_TOKEN`, held the GitHub CLI OAuth token of a second maintainer.
4. At 22:14:14 the attacker deleted the run with the owner's token.

The GitHub audit log records a hash of the token behind each action, and the hash of `GH_TOKEN` matches the token that approved the release in step 5.

### Step 3: the same on BerriAI/litellm-auto (October 10, 22:12)

1. Twenty-four seconds after step 2, commit `78d968b` on branch `ci-tmp-be33e9` in `BerriAI/litellm-auto` ran a workflow that posted `RELEASE_PLEASE_TOKEN` to the same endpoint.
2. That secret held the GitHub CLI OAuth token of a third maintainer.
3. The run was deleted at 22:14:31.

Its token hash matches the token that deleted the release runs in step 6.

### Step 4: the release workflow is pointed at a fork (October 21, 10:08 to 11:08)

Our releases are built by workflows in the private `BerriAI/project-releaser` repository. From `199.91.221.39`, the attacker changed where those workflows take their source from.

1. The attacker authored commit `9cf97e9` ("ci: release from a fork source repository") as the organization owner. It let the release workflow build from a source repository other than `BerriAI/litellm`.
2. At 10:08:29 a push of that commit to `main` with the second maintainer's token was rejected by branch protection, which requires a pull request and two passing checks.
3. At 10:08:34 the same push with the owner's token succeeded by overriding those rules.
4. At 10:46:39 the attacker dispatched the staging workflow at `9cf97e9`, as the owner, with the source set to the lookalike `Berri-AI/litellm` at commit `20535d8f`.
5. The staging run finished at 11:08:09 and the production release pipeline started at 11:08:53.

Commit `20535d8f` exists only on the attacker's fork, but it opens at `github.com/BerriAI/litellm/commit/20535d8f` because GitHub serves a fork's commits through the repository it was forked from.

### Step 5: the production gate is approved with a stolen token (11:11:18)

1. The second maintainer's token approved the production environment gate of the release run, from `199.91.221.39`.
2. The pipeline signed and published `v1.107.0` built from the fork commit.
3. Seven PyPI wheels went out between 11:39:51 and 11:40:13.
4. The Docker Hub and GHCR images went out at 11:46:56.

### Step 6: the run records are deleted (11:53)

1. The third maintainer's token deleted the production run record at 11:53:49.
2. It deleted the staging run record at 11:54:01.

Both deletions removed the workflow logs from the repository.

### Step 7: the workflow history is force-pushed clean (12:09 to 12:24)

With the owner's token, again by overriding branch protection, the attacker removed the change from the visible history.

1. At 12:09:32 the attacker committed a revert of `9cf97e9`, commit `285fbdc5`, and pushed it at 12:09:38.
2. At 12:24:52 they force-pushed `main` back to `d687b69`, the commit before the change, overriding GitHub's force-push block as well.

`main` then showed neither the change nor the revert. Both commits are still retrievable by SHA, and the organization audit log recorded each override.

## Indicators

| Indicator | Value | Where it appears |
|---|---|---|
| IP address | `69.48.229.143` | Agent Platform API requests on October 10 |
| IP address | `199.91.221.39` | `BerriAI/project-releaser` pushes and the gate approval on October 21 |
| Lookalike organization | `Berri-AI` | Fork of `BerriAI/litellm` used as the release source |
| Commit | `20535d8f` | The fork commit the release was built from |
| Branch | `ci-tmp-a351cc` | `BerriAI/litellm`, workflow posting secrets to `webhook.site` |
| Branch | `ci-tmp-be33e9` | `BerriAI/litellm-auto`, workflow posting secrets to `webhook.site` |
| Commit | `9cf97e9` | `BerriAI/project-releaser`, the workflow change, outside the history of `main` |
| Commit | `285fbdc5` | `BerriAI/project-releaser`, the revert, outside the history of `main` |

The compromised artifacts were live for about two hours before they were pulled. The [incident post](/blog/security-incident-oct-21-2026) lists the affected versions, how to check for exposure, and the cleanup steps. If you discover a security issue in LiteLLM, please report it through our [bug bounty program](https://github.com/BerriAI/litellm/security).
