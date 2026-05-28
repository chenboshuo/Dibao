# Dibao Release Process

This document records the release workflow for Dibao's BUSL-1.1 delayed-open-source licensing model.

## BUSL Version Management

1. Every release tag must freeze `LICENSE.md`.
2. Every version's Release Date is the date that specific version is first publicly released.
3. Every version's Change Date is its Release Date plus 4 years.
4. The Change License is fixed as Apache License 2.0 (`Apache-2.0`).
5. The `main` branch `LICENSE.md` can represent the current development version and may contain TODO dates, but legal certainty comes from the `LICENSE.md` in each release tag.
6. Docker images and GitHub Releases must use explicit version numbers. Do not rely only on `latest`.
7. After the Change Date, maintainers may add a `vX.Y.Z-apache` convenience tag or update the GitHub Release notes to state that the version is now available under Apache-2.0. This is not required for the license change to take effect.

## Release Checklist

- [ ] Update `package.json` version.
- [ ] Confirm Release Date.
- [ ] Calculate Change Date as Release Date plus 4 years.
- [ ] Run `node scripts/release/update-license.mjs <version> <release-date>`.
- [ ] Confirm `LICENSE.md` has the correct Licensed Work, Release Date, and Change Date.
- [ ] Confirm Docker license labels carry `BUSL-1.1`, `Apache-2.0`, and the release Change Date.
- [ ] Update CHANGELOG or release notes.
- [ ] Check README License section for accuracy.
- [ ] Run release gates appropriate for the release scope.
- [ ] Create the release tag only after explicit approval.
- [ ] Publish the Docker image with an explicit immutable version tag.
