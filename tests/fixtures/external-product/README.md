# External-product fixture

Tiny synthetic Aurii project used by platform CI after Norwegian Geo leaves the monorepo.

Domain: **Region** and **City**. Not Norwegian geography.

```text
define/register schema
        ↓
write/import entities
        ↓
enable delivery/public route
        ↓
consume via SDK/API
        ↓
receive expected result
```

| Surface | Allowed Aurii imports |
|---------|------------------------|
| `aurii.config.ts`, routes, sources | `@aurii/core` (project package) |
| `studio/studio.config.ts` | `@aurii/studio` (operator config) |
| `consumer.ts` | `@aurii/sdk` only |

This fixture is **not** a product. It exists so Aurii can prove the external-consumer contract without shipping a real domain dataset.

It is a private workspace member so `aurii.config.ts` can import `@aurii/core` during Aurii CI. That `workspace:*` is **only** for this in-repo fixture. Packed-package independence is proven by `tests/pack/pack-public-packages.test.ts`, not by this package.json.
