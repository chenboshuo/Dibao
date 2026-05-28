# Contributing to Dibao

Thanks for considering a contribution to Dibao / 邸报. Dibao is source-available, fair-code, and self-hostable under the Business Source License 1.1 (BUSL-1.1), with each released version changing to Apache License 2.0 after its Change Date. Contributions are welcome, but all contributions must support the project's current BUSL-1.1 license and possible future Apache-2.0, commercial, hosted, proprietary, or enterprise licensing.

## Contribution Flow

1. For bugs, documentation fixes, small UI copy changes, and narrow maintenance patches, open a pull request directly.
2. For significant features, architecture changes, data migrations, recommendation behavior changes, public API changes, or licensing-sensitive changes, open an issue first so the scope can be discussed.
3. Keep pull requests focused. Separate unrelated changes into separate PRs.
4. Add or update tests when the change affects behavior.
5. Keep user-facing text accurate: Dibao is fair-code, source-available, self-hostable, and delayed-open-source under BUSL-1.1. Do not describe the current pre-Change-Date version as OSI-approved open source.

## Contributor License

By submitting a contribution to Dibao, you agree that:

1. You have the legal right to submit the contribution.
2. You retain copyright in your contribution.
3. You grant the Dibao project maintainers a perpetual, worldwide, non-exclusive, free of charge, royalty-free, irrevocable license to use, copy, modify, distribute, sublicense, and relicense your contribution.
4. Your contribution may be used by the Dibao project maintainers under BUSL-1.1, Apache-2.0 after the Change Date, commercial licenses, proprietary licenses, official hosted versions, enterprise editions, or other Dibao-related offerings.
5. If your contribution is made on behalf of an employer, client, school, organization, or other entity, you confirm that you have the authority to grant the license above.

This contributor license is required so the project can keep accepting community contributions while preserving the ability to offer commercial dual licensing, official hosting, and enterprise development in the future.

## Code and Content You Must Not Submit

Do not submit:

1. Third-party code, documentation, assets, data, or models unless their license is compatible and you clearly identify the source and license.
2. Code owned by your employer, client, school, or organization unless you are authorized to contribute it.
3. Confidential, proprietary, trade-secret, private, or restricted materials.
4. AI-generated code or content unless you are confident you have the rights needed to submit it under the Contributor License above.
5. Dependencies or generated files that introduce license obligations incompatible with BUSL-1.1, the future Apache-2.0 Change License, or the repository's third-party dependency licenses.

## Development Notes

Install dependencies and run the common checks from the repository root:

```bash
npm install
npm run typecheck
npm test
```

Some changes may also require:

```bash
npm run build
npm run e2e
```

If a check is not practical to run locally, mention that in the pull request and explain what was verified instead.
