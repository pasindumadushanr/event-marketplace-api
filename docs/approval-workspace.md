# Vendor application review workspace

The queue supports case-insensitive search, all 25 districts, category branches (including their children), Sri Lanka submission-date ranges, status tabs/filters, and server pagination (25 applications). It sorts by submission time, oldest first. Legacy submission dates use the business creation date because no separate timestamp existed. Resubmission resets the submission date.

## Workflow

- Pending includes `PENDING`, `UNDER_REVIEW`, and `NEEDS_INFO`.
- Administrators can approve/reject/request information for pending or under-review applications. Conditional status writes prevent two reviewers from deciding simultaneously.
- Every decision leaves the business unpublished. Approval is not publication or a verification badge. The vendor completes their profile and uses the existing publish action.
- `NEEDS_INFO` is not rejection. The request is shown in the vendor dashboard. The vendor can upload documents and update the existing onboarding form, then resubmit without creating another business.
- Rejected applications can also be corrected and resubmitted. Approved/suspended/under-review applications cannot use the resubmission endpoint.
- Review details, supporting documents, internal notes, and event history are administrator-only. Internal notes are separate from vendor-visible messages; they are never emailed. General admin activity entries redact note/reason contents.
- Decisions and their review/audit records are atomic. Notes and history have no edit/delete API.
- Decision emails use the account email, not a potentially different business-contact email. Text is HTML-escaped. Email failure never undoes a decision or falsely reports it as unsaved.
- Notification status is recorded. Administrators can retry unsuccessful emails from history. An atomic claim avoids simultaneous retries; a five-minute stale sending claim can be reclaimed. Superseded decisions and private notes cannot be sent as decision emails.
- "Email accepted by provider" is not a guarantee of inbox delivery. An interrupted request between provider acceptance and recording status can cause a later retry to resend; SMTP cannot guarantee exactly-once delivery.
- New detailed history begins with this release; earlier general decisions remain in Admin Activity History.

## Database rollout

For the legacy unbaselined Neon database, back up and verify the target first. Run `npm run approvals:check`, then (only after approval) set `APPROVAL_ROLLOUT_CONFIRM=marketplace-backed-up` and run `npm run approvals:rollout`. Verify with `approvals:check` again before pushing/deploying the backend. The script adds the state, new fields, index and private history table, initializes only the new submission field, and does not change existing decisions or visibility. Never run blindly through the old initial Prisma migration.

New baselined databases can use the checked-in migration normally. Deploy the backend before the frontend where possible. Old callers keep an array response; the new paginated UI uses `workspace=1`. If a new frontend reaches an old backend, it shows a retryable loading error instead of inaccurate unfiltered results. After `NEEDS_INFO` is used, do not roll back to a client/backend that cannot handle this state.

Verify with test applications: district/category/date filters, oldest order, private note, request-information, document upload, vendor resubmission, approval without publication, rejection email, notification retry, and concurrent decision conflict. Never use real vendor approvals merely as a deployment test.
