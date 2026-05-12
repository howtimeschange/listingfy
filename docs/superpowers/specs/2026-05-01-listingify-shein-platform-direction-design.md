# Listingify SHEIN Platform Direction Design

## Purpose

This design consolidates the legacy Listingify platform-thinking documents with the current project state. The current system has already completed a real SHEIN full-managed single-listing publish path, so the next product and engineering step is not another broad rewrite. The next step is to stabilize batch publishing, formalize task and exception loops, and preserve clean platform boundaries for future TEMU work.

## Current Baseline

As of 2026-05-01, the project has these working foundations:

1. MDM and DeepDraw data are stored as product facts and content packages.
2. SHEIN metadata, category rules, attributes, image rules, size conversion, package rules, price rules, low-multiple lists, and SKU weights are queryable and maintainable.
3. SHEIN product bucket separates platform-specific preparation fields from product facts.
4. SHEIN publish drafts support SPU/SKC/SKU editing, image selection/upload, image confirmation, class/category selection, size mapping, price/package/weight maintenance, versioning, validation, and publish submission.
5. Publish tasks preserve request/response payload, trace ID, failure reason, retry entry, and SHEIN platform identities.
6. Auth, RBAC, platform integration settings, and operation logs are already present.

## Design Direction

The product should keep the current SHEIN-first focus and adopt three loops from the old project:

1. **Fact loop:** MDM and DeepDraw are source facts. Listingify mirrors and enriches them without letting SHEIN fields pollute the fact model.
2. **Publish loop:** every publish action creates a versioned package snapshot, submits through a task, and records platform response and platform identity.
3. **Exception loop:** every blocker, publish failure, image conversion failure, audit rejection, and status-sync failure must become a business-visible item with a repair path.

## Architecture

The architecture remains modular monolith:

```text
Source Layer -> Fact Layer -> Rule Layer -> Listing Layer -> Execution Layer -> Adapter Layer -> Governance Layer
```

Important boundaries:

1. `product_*` and `product_content_*` stay platform-neutral.
2. `shein_product_bucket` and SHEIN metadata tables may be SHEIN-specific.
3. `listing_*`, `platform_identity`, publish tasks, and exceptions should remain platform-aware but not SHEIN-only where a generic shape is practical.
4. SHEIN adapter owns signing, rules, image upload/transform, payload construction, response parsing, and error normalization.
5. TEMU remains a reserved adapter target, not an active delivery scope.

## Product Surface

The user-facing flow should remain:

```text
Product Archive
  -> SHEIN Product Bucket
  -> SHEIN Publish Drafts
  -> Listing Batches
  -> Publish Tasks
  -> Exceptions
```

The batch detail page becomes the main operational center for bulk work. It should show draft status distribution, task status distribution, failure groups, last sync time, and actions for validation, task generation, status sync, and retry.

The draft detail page remains the main repair surface. Exceptions and validation issues should link back to exact modules: SHEIN category, attributes, SKC images, SKU size, SKU price, SKU weight, or package fields.

## Data Design

The most important new structures are:

1. `listing_publish_task_item`: supports partial success and item-level failure tracking.
2. `exception_record` and `exception_event`: turn task and validation failures into operational workflow.
3. `field_lineage_event`: records AI, rule, sync, and manual field changes.

Existing version and task tables should be enhanced rather than replaced. `listing_publish_version` remains the core publish-package snapshot record.

## Error Handling

Failure categories should be normalized:

```text
VALIDATION
IMAGE
PRICE
PACKAGE
DUPLICATE_SKU
AUTH
RATE_LIMIT
NETWORK
SHEIN_PRE_VALIDATION
SHEIN_AUDIT
SHEIN_SERVER
UNKNOWN
```

Each normalized failure needs a category, fingerprint, retryability flag, user-facing message, and repair suggestion.

## Testing

Every implementation phase must keep the current verification gate:

```bash
npm test
npm run web:build
npm run web:lint
```

New backend work should add node tests under `scripts/lib/*.test.mjs`. New frontend flow wiring should add static UI tests similar to the existing project pattern.

## Scope

In scope for the next delivery path:

1. Batch publish stabilization.
2. Batch status summary and status sync.
3. Failure aggregation and retry.
4. Publish package summary and version diff.
5. Exception workbench.
6. Field lineage and rule governance.
7. Platform adapter boundary cleanup.

Out of scope:

1. TEMU real publishing.
2. Cross-platform one-click publishing.
3. Orders, fulfillment, procurement, inventory, settlement, and finance.
4. Full compliance asset center.
5. Automatic image generation.
6. Cross-platform listing status control or direct price adjustment.

## Written Artifacts

This design produced:

1. `docs/prd-listingify-shein-mvp-and-platform-direction-2026-05-01.md`
2. `docs/spec-listingify-shein-mvp-and-platform-direction-2026-05-01.md`
3. `docs/superpowers/plans/2026-05-01-listingify-shein-platform-direction.md`
