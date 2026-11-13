# Remaining dependency advisory review

Local patched dependency sets; these findings do not describe the deployed versions until deployment is verified.

## Backend: Prisma configuration toolchain

The earlier audit reported three linked high entries: Prisma → @prisma/config → deepmerge-ts 7.1.5. The root issue is [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): merging two JavaScript object graphs with self-references can exhaust the stack. Ordinary parsed JSON does not produce those references.

Source inspection shows the imported merger in @prisma/config is used for loading local Prisma configuration files. The root prisma.config.ts contains trusted schema/migration-path settings. No application `src` imports deepmerge-ts, @prisma/config or prisma/config, and no route supplies user data to this configuration merger.

A targeted package override now pins ONLY @prisma/config's deepmerge-ts dependency to the patched 8.0.0. This is a major-version override, so compatibility was checked explicitly: Prisma 6.19.3 client generation passed with the repository config, a 29-table schema/history rehearsal and no-op migration deploy passed, backend build passed, and all 485 backend tests passed. Current production-package audit reports zero backend advisories. No database schema/data changes or Prisma 7 migration were performed. Keep these toolchain checks when upgrading Prisma or removing the override; version 8 changes Map-merging semantics, although this config uses no Maps.

## Frontend: Quill HTML export

Two linked low entries remain: react-quill-new → quill 2.0.3, [GHSA-v3m3-f69x-jf25](https://github.com/advisories/GHSA-v3m3-f69x-jf25). The advisory lists no patched Quill version. Do not downgrade the editor automatically to satisfy audit output.

The shared public rich-text helper previously used regular expressions during server rendering. It now uses a parser-based tag/attribute/protocol allowlist on both server and browser. Embedded active content, inline event handlers, inline style, data-image sources and unsafe URL schemes are removed. Policy pages already use a separate restricted parser allowlist. Added regression tests cover encoded URL attacks as well as ordinary formatting. The editor also sets useSemanticHTML=false, avoiding its default getSemanticHTML export path. These controls mitigate unsafe rendering/export; they do not remove the underlying Quill advisory. Reassess editor replacement or an upstream fix before allowing untrusted users to author arbitrary HTML.

## Verification scope

No exploit was sent to production. Regression inputs are local only. Package audit is a point-in-time check; audit again before deployment. Keep the dependency advisory items open until patched/replaced or explicitly accepted with documented scope.
