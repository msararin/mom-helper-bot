# Repository Architecture Guide

## Purpose

This repository is designed to demonstrate more than a working chatbot or automation script.

It is a maintainable AI assistant prototype that can evolve toward a privacy-aware, RAG-ready, multi-provider architecture.

The goal is to show:

- clear architectural thinking
- separation of concerns
- testability
- maintainability
- provider flexibility
- guardrail readiness
- future RAG integration
- practical delivery discipline

This project should not only prove that the feature works.

It should also prove that the system is designed in a way that can be understood, tested, refactored, and extended.

---

# 1. Architecture Overview

## Design Principle

The system should avoid placing all logic inside `index.js`.

`index.js` should act as a thin entry point that wires the application together, while the actual logic is separated into focused modules.

The core logic should not be tightly coupled to LINE, OpenAI, Google Apps Script, Google Sheets, or any single AI provider.

External tools should be treated as adapters.

## Why This Matters

A single large `index.js` file may be acceptable for an early MVP, but it becomes difficult to maintain as the system grows.

Problems with putting everything in one file:

- harder to read
- harder to test
- harder to debug
- harder to replace external services
- higher chance of regression
- unclear architectural intent
- difficult for reviewers to understand the system boundaries

The goal of the refactor is not to make the project look fancy.

The goal is to make the system easier to reason about.

---

# 2. Recommended Folder Structure

```text
src/
  index.js

  handlers/
    lineWebhookHandler.js

  usecases/
    handleIncomingMessage.js
    processOrderRequest.js

  services/
    aiResponseService.js
    ragContextService.js
    orderService.js
    conversationService.js

  guardrails/
    privacyGuard.js
    inputGuard.js
    responseGuard.js

  adapters/
    lineAdapter.js
    openaiAdapter.js
    googleAppsScriptAdapter.js
    knowledgeBaseAdapter.js

  config/
    env.js

  utils/
    logger.js
    errors.js

tests/
  regression/
    lineWebhook.regression.test.js
    orderFlow.regression.test.js
    guardrail.regression.test.js

  unit/
    inputGuard.test.js
    privacyGuard.test.js
    responseComposer.test.js
    env.test.js

docs/
  ARCHITECTURE_GUIDE.md
```

This structure is intentionally simple.

It is inspired by ports-and-adapters / hexagonal architecture, but it does not over-engineer the project too early.

---

# 3. Layer Responsibilities

## Entry Point

### `src/index.js`

Responsible for:

- starting the application
- receiving the initial request
- loading configuration
- registering routes or webhook entry points
- delegating work to handlers
- handling top-level errors

It should not contain:

- business logic
- AI prompt logic
- RAG retrieval logic
- privacy rules
- order flow logic
- provider-specific implementation details

A good `index.js` should be boring.

That is a good sign.

---

## Handlers

Example:

```text
src/handlers/lineWebhookHandler.js
```

Handlers are responsible for platform-specific input handling.

They may:

- receive LINE webhook payloads
- validate basic request shape
- extract message text
- extract user ID
- normalize incoming events
- pass clean input to use cases

Handlers should not make deep business decisions.

They should translate platform input into application input.

---

## Use Cases

Examples:

```text
src/usecases/handleIncomingMessage.js
src/usecases/processOrderRequest.js
```

Use cases are responsible for orchestrating a specific user flow.

They may coordinate:

- services
- guardrails
- adapters
- response composition
- error handling

Use cases answer the question:

> What should the application do for this user request?

Examples:

- handle incoming message
- process order request
- confirm order
- check order status
- generate response

Use cases should be readable and business-focused.

---

## Services

Examples:

```text
src/services/aiResponseService.js
src/services/ragContextService.js
src/services/orderService.js
src/services/conversationService.js
```

Services contain application logic.

They may handle:

- AI response preparation
- order logic
- conversation state
- context selection
- response composition
- RAG context preparation

Services should avoid knowing too much about external tools.

For example, `aiResponseService.js` should not directly know whether the model is OpenAI, Claude, Gemini, or another provider.

That should be handled by an adapter.

---

## Guardrails

Examples:

```text
src/guardrails/inputGuard.js
src/guardrails/privacyGuard.js
src/guardrails/responseGuard.js
```

Guardrails are first-class modules.

They should not exist only as hidden prompt text.

They are responsible for protecting the system from unsafe, invalid, or inappropriate behavior.

Potential responsibilities:

- input validation
- privacy rules
- response safety checks
- context usage restrictions
- sensitivity-level checks
- unsafe output prevention
- future prompt injection mitigation

This is especially important for AI and RAG systems because the model may receive dynamic context.

---

## Adapters

Examples:

```text
src/adapters/lineAdapter.js
src/adapters/openaiAdapter.js
src/adapters/googleAppsScriptAdapter.js
src/adapters/knowledgeBaseAdapter.js
```

Adapters connect the application to external systems.

External systems may include:

- LINE Messaging API
- OpenAI API
- Google Apps Script
- Google Sheets
- markdown knowledge base
- vector database
- future AI providers

Adapters allow the core logic to remain independent from infrastructure choices.

This makes it easier to replace:

- LINE with a web app
- OpenAI with Claude, Gemini, or another provider
- Google Apps Script with a database
- markdown files with a vector database
- rule-based context selection with RAG retrieval

---

## Config

Example:

```text
src/config/env.js
```

Config modules are responsible for:

- reading environment variables
- validating required config
- preventing the app from starting with missing secrets
- centralizing configuration logic

The application should fail fast if required config is missing.

---

## Utils

Examples:

```text
src/utils/logger.js
src/utils/errors.js
```

Utils should contain small reusable helpers.

They should not become a dumping ground for business logic.

---

# 4. Ports-and-Adapters Inspiration

This project does not need to implement full hexagonal architecture from day one.

However, it should follow the core idea:

> Core application logic should not depend directly on external tools.

External systems should be replaceable.

The system should be designed so that changing an external provider does not require rewriting the core application flow.

## Simple Mental Model

```text
User / LINE
   ↓
Adapter: lineAdapter
   ↓
Handler: lineWebhookHandler
   ↓
Use Case: handleIncomingMessage
   ↓
Services:
   - aiResponseService
   - ragContextService
   - orderService
   - conversationService
   ↓
Guardrails:
   - inputGuard
   - privacyGuard
   - responseGuard
   ↓
Adapters:
   - openaiAdapter
   - googleAppsScriptAdapter
   - knowledgeBaseAdapter
```

The core logic should know what it needs.

It should not care too much about where the input came from or which external provider fulfills the request.

---

# 5. Architecture Decision Records

This section records key architectural decisions and the reasoning behind them.

The purpose is not to over-document every change.

The purpose is to show disciplined system thinking.

---

## ADR-001: Start with a Working MVP Before Full Architecture

### Status

Accepted

### Context

The first version of the system prioritized getting the main user flow working.

This allowed the project to validate whether the bot could receive messages, process user intent, call external services, and return useful responses.

### Decision

Start with a simple implementation first, even if some logic initially lives in `index.js`.

### Reason

The immediate priority was to prove that the core feature worked before investing in a more complex architecture.

### Trade-off

This made the first version faster to build, but reduced maintainability as logic grew.

### Next Step

Refactor the codebase into focused modules:

- handlers
- use cases
- services
- adapters
- guardrails
- config
- tests

---

## ADR-002: Keep `index.js` as a Thin Entry Point

### Status

Proposed

### Context

A large `index.js` file makes the application harder to read, test, and maintain.

It also hides architectural intent.

### Decision

Move most logic out of `index.js`.

`index.js` should only:

- initialize configuration
- register routes or webhook entry points
- delegate work to handlers
- handle top-level errors

### Reason

This improves readability and makes the system easier to test and extend.

### Trade-off

More files are introduced, so the folder structure must remain simple and understandable.

---

## ADR-003: Separate External Integrations into Adapters

### Status

Proposed

### Context

The system may depend on external services such as LINE, OpenAI, Google Apps Script, Google Sheets, or a future vector database.

If core logic depends directly on these tools, future changes become difficult.

### Decision

Place external integration logic into adapter modules.

Examples:

- `lineAdapter.js`
- `openaiAdapter.js`
- `googleAppsScriptAdapter.js`
- `knowledgeBaseAdapter.js`

### Reason

This keeps the core application logic independent from infrastructure choices.

### Benefit

The system can later support different:

- messaging platforms
- AI providers
- databases
- storage layers
- RAG engines

without rewriting the core logic.

---

## ADR-004: Add Guardrails as First-Class Modules

### Status

Proposed

### Context

AI assistant systems should not rely only on prompt instructions for safety, privacy, or reliability.

Guardrails should be visible in the architecture.

### Decision

Create a dedicated `guardrails/` folder.

Potential modules:

- `privacyGuard.js`
- `inputGuard.js`
- `responseGuard.js`

### Reason

This makes privacy, validation, and safety part of the system design rather than hidden prompt text.

### Future Direction

Guardrails may later support:

- sensitivity-level checks
- context permission rules
- prompt injection protection
- response filtering
- audit logs
- retrieval constraints

---

## ADR-005: Prioritize Regression Tests Before Refactoring

### Status

Accepted

### Context

Refactoring can accidentally break existing working flows.

AI-related systems are especially sensitive because behavior can change due to code, prompt, context, or provider updates.

### Decision

Before major refactoring, define regression tests for the main flow.

### Test Priorities

1. Main user flow still works.
2. Order flow does not break.
3. Guardrails are still applied.
4. External service failures are handled safely.
5. Response format remains stable.

### Reason

This protects the project from breaking while improving architecture.

### Trade-off

Writing tests takes extra time upfront, but reduces risk during refactoring and deployment.

---

## ADR-006: Use Simple Ports-and-Adapters Principles Without Over-Engineering

### Status

Proposed

### Context

Hexagonal architecture can improve maintainability, but applying it too heavily too early may slow down a small prototype.

### Decision

Use the spirit of ports-and-adapters without forcing a complex enterprise structure.

### Principle

Core logic should not know too much about:

- LINE
- OpenAI
- Google Apps Script
- Google Sheets
- future vector databases

These should be replaceable infrastructure details.

### Reason

This balances practical MVP delivery with architectural maturity.

### Trade-off

The structure may not be fully hexagonal yet, but it remains understandable and extensible.

---

## ADR-007: Document the Evolution from MVP to Maintainable Prototype

### Status

Accepted

### Context

This repository is also a portfolio piece.

It should show not only the final code, but the developer's reasoning process.

### Decision

Maintain documentation that explains:

- why the MVP started simple
- why refactoring was needed
- how modules are separated
- how tests protect behavior
- how the design can evolve toward RAG and multi-provider AI

### Reason

Good architecture is not only about code structure.

It is also about trade-off awareness, prioritization, and communication.

---

# 6. Testing Strategy

## Purpose

The testing strategy is designed to protect the main user flow while the codebase evolves from a simple MVP into a more maintainable architecture.

The goal is not to create excessive tests too early.

The goal is to ensure that important behavior does not break during refactoring, deployment, or future AI-provider changes.

## Testing Priorities

Regression tests should focus on the flows that matter most.

Priority order:

1. Main user flow works correctly.
2. Order flow does not break.
3. Guardrails still apply.
4. External adapter failures are handled safely.
5. Response format remains stable.
6. Environment variables are validated.
7. Unknown inputs are handled gracefully.

## Why Regression Tests Matter

In AI-assisted systems, behavior can change because of:

- code changes
- prompt changes
- model changes
- context changes
- integration changes
- response format changes
- external API failures

Regression tests help confirm that the system still behaves correctly after these changes.

## Recommended Test Structure

```text
tests/
  regression/
    lineWebhook.regression.test.js
    orderFlow.regression.test.js
    guardrail.regression.test.js

  unit/
    inputGuard.test.js
    privacyGuard.test.js
    responseComposer.test.js
    env.test.js

  fixtures/
    lineTextMessage.json
    orderRequestMessage.json
    unknownMessage.json
```

## Regression Test Cases

### 1. LINE Webhook Receives Text Message

Expected behavior:

- accepts a valid LINE webhook payload
- extracts user ID
- extracts user message
- passes normalized input to the use case
- returns a successful response

### 2. Main Conversation Flow

Expected behavior:

- receives a user message
- processes intent
- calls the correct service
- returns a valid reply object

### 3. Order Flow

Expected behavior:

- captures item details
- captures quantity
- confirms order information
- handles missing required fields
- does not submit incomplete orders

### 4. Guardrail Flow

Expected behavior:

- rejects invalid input
- prevents unsafe or restricted context usage
- avoids exposing unnecessary sensitive information
- returns safe fallback behavior when a rule fails

### 5. External Adapter Failure

Expected behavior:

- handles API failure without crashing
- logs meaningful error information
- returns a user-safe error message
- does not expose internal secrets or stack traces

### 6. Environment Validation

Expected behavior:

- checks required environment variables
- fails fast when required config is missing
- does not start with incomplete configuration

## Unit Test Examples

Potential units to test:

- input validation
- message normalization
- response formatting
- guardrail checks
- adapter error handling
- environment config loading

## Manual Test Checklist Before Deployment

Before deployment, verify:

- [ ] Bot receives message correctly.
- [ ] Bot replies successfully.
- [ ] Main order flow works.
- [ ] Invalid input is handled safely.
- [ ] Required environment variables are present.
- [ ] No secrets are committed.
- [ ] Logs do not expose sensitive values.
- [ ] Regression tests pass.
- [ ] Deployment target has correct config.

## Suggested Commands

Example only. Adjust based on the repository setup.

```bash
npm test
npm run test:regression
npm run lint
npm run dev
```

## Testing Philosophy

The project should not chase perfect test coverage too early.

Instead, it should protect the behavior that matters most:

- the main feature
- the user flow
- the guardrail logic
- the integration boundary
- the deployment pipeline

This demonstrates engineering discipline without slowing down MVP delivery.

---

# 7. Privacy and Guardrail Design

## Purpose

This repository is designed to evolve toward a privacy-aware AI assistant architecture.

The assistant should not treat all available context as automatically usable.

The system should retrieve and use only the context that is relevant, permissioned, and appropriate for the current task.

## Core Principle

Good AI context design is not about giving the model everything.

Good AI context design is about giving the model the right context, at the right time, with the right boundaries.

## Guardrail Goals

The guardrail layer should help ensure that the system:

- validates user input
- limits unnecessary context exposure
- protects sensitive information
- prevents unsafe response patterns
- handles errors safely
- avoids leaking secrets
- supports future RAG permission rules

## Recommended Guardrail Modules

```text
src/
  guardrails/
    inputGuard.js
    privacyGuard.js
    responseGuard.js
```

## Input Guard

Responsible for validating incoming messages before they reach the main application logic.

Potential checks:

- message exists
- message type is supported
- payload shape is valid
- required fields are present
- text length is within acceptable limit
- unsupported events are ignored gracefully

## Privacy Guard

Responsible for controlling what context can be used.

Potential checks:

- whether context is needed for the task
- whether the context is safe to use
- whether the context sensitivity level is allowed
- whether raw private data should be excluded
- whether the response should use a summarized version instead of full detail

## Response Guard

Responsible for checking the final response before sending it back to the user.

Potential checks:

- no secrets are exposed
- no internal stack traces are exposed
- no unnecessary private context is revealed
- response format is valid
- fallback response is safe and understandable

## Future Sensitivity Levels

For future RAG integration, context can be classified by sensitivity level.

```text
Level 0: Public / shareable
Level 1: Personal but non-sensitive
Level 2: Sensitive personal context
Level 3: Highly sensitive / restricted
```

Default retrieval should prefer Level 0-1.

Level 2 should require clear relevance.

Level 3 should require explicit permission or direct safety relevance.

## Future Retrieval Rules

Before passing context to an AI model, the system should check:

1. What is the user asking?
2. What mode is the request in?
3. What context is relevant?
4. What sensitivity level does the context have?
5. Is this context allowed for this request?
6. Can a safer summary be used instead of raw detail?
7. Should the system refuse, ask for clarification, or proceed?

## Example Modes

Potential request modes:

- career mode
- technical learning mode
- finance mode
- health capacity mode
- emotional support mode
- general chat mode

Different modes should have different context access rules.

## Prompt Injection Awareness

Future implementation should consider prompt injection risks, especially if context is retrieved from external documents.

Potential mitigations:

- treat retrieved documents as untrusted input
- separate system rules from retrieved context
- do not allow retrieved content to override developer or system rules
- sanitize external content
- log suspicious instructions
- apply retrieval filters

## Secret Management

The repository should never commit:

- API keys
- access tokens
- channel secrets
- private keys
- production credentials
- raw sensitive personal data

Recommended files:

```text
.env
.env.local
.env.production
secrets/
*.pem
```

These should be excluded through `.gitignore`.

## Safe Error Handling

Errors shown to users should be safe and minimal.

Bad:

```text
OpenAI API key missing: sk-...
Stack trace...
Internal request payload...
```

Better:

```text
Sorry, I could not process this request right now. Please try again later.
```

Internal logs can contain more detail, but should still avoid secrets.

## Portfolio Value

Visible guardrail design shows that this repository is not just a chatbot.

It demonstrates awareness of:

- privacy-by-design
- RAG context governance
- sensitive data boundaries
- production-readiness
- responsible AI implementation
- enterprise-style AI system thinking

---

# 8. Future RAG Direction

The system can evolve toward a RAG architecture where context is:

- classified by sensitivity level
- retrieved only when relevant
- filtered through permission rules
- passed to the AI model with minimal necessary exposure
- evaluated for retrieval quality
- logged for auditability where appropriate

## Future Components

Potential future modules:

```text
src/
  rag/
    contextClassifier.js
    retrievalRouter.js
    permissionFilter.js
    promptComposer.js
    retrievalEvaluator.js
```

## Future RAG Flow

```text
User request
   ↓
Classify request mode
   ↓
Identify relevant context domains
   ↓
Retrieve candidate context
   ↓
Apply sensitivity and permission rules
   ↓
Compose minimal prompt context
   ↓
Generate model response
   ↓
Apply response guard
   ↓
Return final answer
```

## Enterprise RAG Connection

This architecture can later demonstrate enterprise RAG concepts such as:

- context governance
- access control
- least-privilege retrieval
- sensitive data classification
- auditability
- prompt routing
- hallucination control
- retrieval evaluation
- multi-model portability

---

# 9. Practical Refactoring Priority

The project should evolve with discipline.

Priority order:

```text
1. Keep the main feature working.
2. Add or preserve regression tests.
3. Refactor `index.js` into logical modules.
4. Separate handlers, use cases, services, adapters, guardrails, and config.
5. Validate that tests still pass.
6. Improve documentation.
7. Only then consider deeper architecture changes.
```

This avoids over-engineering.

It also proves good product judgment:

> Make the core feature work first, protect it with tests, then improve architecture safely.

---

# 10. Suggested Codex Refactor Prompt

Use this prompt when asking Codex to refactor the repository:

```text
Refactor this repository to better demonstrate architectural thinking while preserving the current working behavior.

Priority:
1. Do not break the existing main feature.
2. Add or preserve regression test cases for the current working flow.
3. Move logic out of index.js into sensible logical modules.
4. Use a simple ports-and-adapters inspired structure, but do not over-engineer.
5. Separate:
   - handlers
   - use cases
   - services
   - adapters
   - guardrails
   - config
   - tests
6. Keep index.js as a thin entry point.
7. Add or update documentation in docs/ARCHITECTURE_GUIDE.md.

After refactoring, show me:
- the proposed folder structure
- the regression test cases
- what changed
- how to run tests
- any risks before deployment
```

---

# 11. What This Repository Should Prove

This repository should prove that the developer can:

- build a working MVP
- prioritize the main feature before polish
- identify when the MVP needs structure
- refactor toward maintainability
- separate responsibilities clearly
- design around external adapters
- protect core behavior with regression tests
- think about privacy and guardrails early
- prepare for future RAG integration
- explain architecture trade-offs clearly

This is the difference between:

> I built a bot.

and

> I built a working AI assistant prototype with maintainable architecture, testing discipline, privacy-aware guardrails, and a clear path toward RAG and multi-provider extensibility.

---

# 12. Summary

This is not just a chatbot project.

It is a working prototype for a privacy-aware AI assistant architecture, designed with modularity, testing, guardrails, and future RAG integration in mind.

The architecture should remain practical.

The system does not need to be over-engineered.

But it should clearly show that the developer understands:

- what belongs in the core logic
- what belongs in adapters
- where guardrails should live
- what should be tested before deployment
- how the system can evolve beyond the first MVP
