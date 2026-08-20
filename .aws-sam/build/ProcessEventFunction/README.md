# Cloud Event – Distributed Event Processing Pipeline

A small, fault-tolerant, multi-tier event processing pipeline built using AWS
serverless services.

The project demonstrates an event-driven architecture where an uploaded file
flows through Amazon S3, AWS Lambda, and Amazon DynamoDB. Failed processing
attempts are automatically retried and eventually routed to an Amazon SQS
Dead-Letter Queue (DLQ).

---

## Architecture

```text
                    ┌─────────────────┐
                    │   Upload File   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Amazon S3     │
                    │  Upload Bucket  │
                    └────────┬────────┘
                             │
                       S3 Event Trigger
                             │
                             ▼
                    ┌─────────────────┐
                    │  AWS Lambda     │
                    │ ProcessEvent    │
                    │    Function     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   DynamoDB      │
                    │  CloudEvent     │
                    │    Results      │
                    └─────────────────┘

                             │
                       On failure
                       after retries
                             │
                             ▼
                    ┌─────────────────┐
                    │      SQS        │
                    │  Dead-Letter    │
                    │     Queue       │
                    └─────────────────┘