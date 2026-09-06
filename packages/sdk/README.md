# @aurii/sdk

Typed HTTP client for the Aurii Runtime.

Product frontends, Studio, CLI tools, and AI agents should use this package instead of constructing raw requests. It talks only to public Core HTTP / published-route contracts.

```ts
import { createClient } from "@aurii/sdk";

const client = createClient({
  baseUrl: "http://localhost:3000",
  defaultDataset: "catalog",
});

const regions = await client.published.get("catalog", "/regions");
```

This package has **no** dependency on `@aurii/core` or `@aurii/db`.

See [`docs/PACKAGES.md`](../../docs/PACKAGES.md) for experimental 0.x distribution.
