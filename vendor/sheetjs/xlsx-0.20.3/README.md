# Reviewed SheetJS Community Edition artifact

LTE vendors the minimum files needed to build and type-check the spreadsheet preview without a URL dependency in `package.json`.

- Package: `xlsx@0.20.3`
- Official release tarball: `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- Retrieved: 2026-08-11
- Tarball SHA-256: `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`
- Tarball SRI: `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`
- License: Apache-2.0 (official `package/LICENSE` retained as `LICENSE`)

Reviewed files copied byte-for-byte from the official tarball:

| Vendored file | Tarball path | SHA-256 | Purpose |
| --- | --- | --- | --- |
| `xlsx.mjs` | `package/xlsx.mjs` | `1a0fb062ee9781b13f6687371b202aaefc53b6ce55b530c027e01f9c087b77db` | ESM runtime |
| `types/index.d.ts` | `package/types/index.d.ts` | `191e4e6aceae3602aa3a1e9a6bc0e98821d6d5fb787e2bc16e250439482bddb6` | Type declarations |
| `LICENSE` | `package/LICENSE` | `4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64` | License text |

The dependency policy validates the exact directory contents and hashes. URL dependencies remain prohibited; this review does not create a manifest URL exception.