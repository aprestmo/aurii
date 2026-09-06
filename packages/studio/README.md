# @aurii/studio

Declarative helpers for project Studio configuration (`defineStudio`, navigation collections, sources/imports groups).

This is operator-workspace configuration. Product frontends must not depend on it at runtime.

```ts
import { collection, defineStudio } from "@aurii/studio";

export default defineStudio({
  title: "My project",
  featuredSchemas: ["city"],
  navigation: [{ title: "Data", items: [collection("city")] }],
});
```

See [`docs/PACKAGES.md`](../../docs/PACKAGES.md) for experimental 0.x distribution.
