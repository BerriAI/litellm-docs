---
title: Compliance and SOC 2 Type II
description: LiteLLM is SOC 2 Type II audited. Get the report from the Trust Center, and find the answers for your security review about data handling, signed images, and vulnerability management.
---

# Compliance and SOC 2 Type II

LiteLLM is SOC 2 Type II audited. Use this page to collect the documents and answers for your security review.

## Get the SOC 2 Type II report

Request the current report through the [LiteLLM Trust Center](https://trust.litellm.ai/).

## Your data stays in your environment

You host the LiteLLM gateway in your environment. When you self-host, LiteLLM does not store data or telemetry on LiteLLM servers. The data that the gateway processes stays in your infrastructure. Refer to [Data privacy and security](../data_security.md).

Some Enterprise functions connect to LiteLLM. [Billable request metering](../proxy/billing_metrics.md) sends only a count of successful requests to the LiteLLM collector. Prompts, responses, virtual keys, and your license key do not leave the deployment. The license check uses the LiteLLM license server, or it does the check offline against a signed payload. Refer to [Licensing across regions](../proxy/multi_region.md#licensing-across-regions).

## Verify the images that you run

LiteLLM signs each Docker image on GHCR with cosign, from v1.83.0. You can verify the signature before you deploy an image, and you can enforce the check in your CI/CD pipeline. Refer to [Verify image signatures](../proxy/docker_image_security.md).

## Vulnerability management

LiteLLM runs `grype` scans on all the Docker images that it builds. To report a vulnerability, use [GitHub Security Advisories](https://github.com/BerriAI/litellm/security/advisories/new). The full policy is in [`security.md`](https://github.com/BerriAI/litellm/blob/main/security.md) in the LiteLLM repository.

For large or major security updates, LiteLLM sends an email to Enterprise customers 7 days before public disclosure. Refer to [Security best practices](../proxy/security_best_practices.md#1-monitor-security-emails-and-upgrade-promptly). The response time for security patches is in [Support and SLA](./support.md).

## Answers for your security questionnaire

These pages give the answers that security teams ask for most:

- [Data privacy and security](../data_security.md): data collection, cookies, vulnerability reports, procurement options, and vendor information.
- [Shared responsibility](../shared_responsibility.md): the problems that LiteLLM owns and the problems that you own.
- [Security and encryption FAQ](../proxy/security_encryption_faq.md): encryption in transit and at rest.
- [OWASP LLM Top 10](../proxy/security_owasp_llm_top10.md): the LiteLLM controls for each OWASP risk, and the limits of each control.
- [Audit logs](../proxy/multiple_admins.md): the record of admin changes to keys, teams, and models.

For a question that these pages do not answer, [book a demo](https://enterprise.litellm.ai/demo) or ask in your Enterprise support channel.
