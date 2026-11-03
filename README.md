# Airic Work

Airic Work is an agent platform for professional workflows. A business system delegates work to an agent, which follows a versioned operating model and asks the task owner for input when a professional judgment is needed. Users can return to the same execution to review progress, provide additional materials, and inspect what the agent did.

## Design principles

**Keep business authority with the business system.** The agent adapts to the materials, context, and progress of the work. It decides what to investigate next, how to proceed, and when to involve a person. The business system enforces its rules. It exposes controlled operations through MCP and checks permissions, business state, and submission requirements when those operations are called. In CertLab, for example, the agent can change the order of document checks or suggest further investigation. CertLab applies its own rules to confirm and record the formal assessment.

**Organize the Operating Model around decisions.** An Operating Model (OM) describes the goals, constraints, and expected outputs for a type of work. Its decision-centric structure brings together the evaluation criteria, required facts, relevant precedents, and known gaps for each key judgment. To determine whether a report can serve as evidence, for example, the agent needs to know what it must cover, which versions are applicable, and how to handle insufficient evidence. The same decision knowledge can be reused at different stages of the work. OM is managed in Git so each execution can use a specific version.

**Give each execution a durable context.** An Execution has a task owner, task inputs, and instructions. It has its own Session and Workspace and pins an OM version when it first starts. The Worker Skill guides the agent in reading the OM, using tools, and requesting human judgment. Answers and additional materials go into the same execution so the agent can build on the context and work already in place. The Session records messages, tool calls, and results for later review.

**Queue human judgments for focused review.** When a judgment needs human input, the agent records a Decision Request with the question, available evidence, missing information, and the work that depends on the answer. It continues with work that can proceed independently. The task owner can set aside time to review the queue and answer requests individually, reducing interruptions during the day. Each answer goes back to the original execution so the agent can resume the affected work. Airic Work records separately when the answer was saved, when it was delivered, and when execution resumed.

**Create and improve OM in familiar agent tools.** Domain experts can use the Operating Model Engineering (OME) Skill in their preferred agent environment to build methods together with an agent. They start with representative cases and ask what makes a result acceptable, how to compare alternatives, and when to stop. Those questions reveal the key judgments, the criteria behind them, and the context each one needs. Execution records that experts are authorized to review can also reveal gaps in the method. Candidate changes are checked against independent cases or reviewed by experts, then adopted through Git review for future executions. [OME Skill](.agents/skills/operating-model-design/SKILL.md)

## A document review in CertLab

CertLab delegates a document review for equipment certification to Airic Work. The agent checks the attachments against a pinned OM version and finds a missing signature page. It creates a Decision Request that identifies the document version, the applicable rule, and the conclusions that depend on the missing page. It continues checking the other attachments. The engineer later opens the queue and answers the pending requests individually. Once the engineer provides a judgment with a clear scope, the agent resumes the affected checks in the original execution. The engineer can review the method version, their answer, and the business operations the agent called.

## Run and integrate

The public image is a **control plane integration preview**. It includes the workbench, HTTP API, persistent storage, and configuration for connecting a business system. Production Workspace support, attachment delivery, automatic dispatch, and recovery are still in development.

```sh
docker pull ghcr.io/airicdev/airic-work:preview
```

The image supports Linux amd64 and arm64. The Compose example provides runtime configuration and a persistent data volume for integrating Airic Work with a business system. [Deployment and integration guide](docs/container-release.md)

## Further reading

- [Product definition](docs/prd.md) · [Technical design](docs/technical-design.md) · [Architecture index](architecture-map.md)
- [Worker and runtime environment](docs/worker-runtime-design.md) · [HTTP and frontend integration](docs/http-integration.md)
- [Backend development and configuration](backend/README.md) · [Frontend development](frontend/README.md)
