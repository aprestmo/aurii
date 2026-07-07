# Aurii Demo Datasets

Ready-to-use example datasets for development, testing and exploration.

Each dataset includes:
- A **schema** YAML defining the structure
- **Sample data** in CSV or JSON format
- An **import definition** YAML for one-command importing

---

## Available Datasets

| Dataset | Format | Records | Description |
|---------|--------|---------|-------------|
| `news/` | CSV | 12 | News articles with author, category and publication date |
| `products/` | CSV | 12 | E-commerce products with pricing and inventory |
| `municipalities/` | CSV | 15 | Norwegian municipalities with population and geographic data |
| `companies/` | JSON | 10 | Company directory with industry, revenue and headquarters |
| `norwegian-geo/` | JSON | ~17,000 | **Canonical product** — Norwegian Geo Core + dataset modules (see `docs/NORWEGIAN_GEO.md`) |

> **For agents:** `norwegian-geo` is the goto reference product. See `docs/NORWEGIAN_GEO.md`, `docs/REFERENCE_DEMO.md` and `AGENTS.md`.

---

## Quick Start

Make sure Aurii Core is running:

```bash
# Start with SQLite (development)
cd packages/core
bun run serve

# Or with Docker (includes PostgreSQL)
docker compose up
```

### Import all demo datasets

```bash
cd packages/core

# News articles
bun run cli schema apply ../demo/news/schema.yaml
bun run cli import run ../demo/news/import.yaml

# Products
bun run cli schema apply ../demo/products/schema.yaml
bun run cli import run ../demo/products/import.yaml

# Municipalities
bun run cli schema apply ../demo/municipalities/schema.yaml
bun run cli import run ../demo/municipalities/import.yaml

# Companies
bun run cli schema apply ../demo/companies/schema.yaml
bun run cli import run ../demo/companies/import.yaml
```

### Query the data

After importing, you can query using the Aurii Query Language:

```bash
# List all published news articles
bun run cli query "FROM news-article WHERE published == true ORDER BY publishedAt DESC LIMIT 5"

# Find products under $100 in stock
bun run cli query "FROM product WHERE price < 100 AND inStock == true"

# Find large municipalities
bun run cli query "FROM municipality WHERE population > 100000 ORDER BY population DESC"

# Find technology companies
bun run cli query "FROM company WHERE industry == Software"
```

### HTTP API

```bash
# List schemas
curl http://localhost:3000/schemas

# Query entities
curl "http://localhost:3000/query?q=FROM+news-article+LIMIT+5"
```

---

## Dataset Reference

### news — News Articles

Schema: `news-article`  
Dataset: `demo-news`

Fields: `headline`, `slug`, `summary`, `author`, `category`, `tags`, `published`, `publishedAt`, `source`

Example query:
```
FROM news-article WHERE category == Technology ORDER BY publishedAt DESC
```

---

### products — Product Catalogue

Schema: `product`  
Dataset: `demo-products`

Fields: `sku`, `name`, `slug`, `description`, `category`, `brand`, `price`, `compareAtPrice`, `currency`, `inStock`, `stockQuantity`, `weight`, `tags`

Example query:
```
FROM product WHERE inStock == true AND price < 100 ORDER BY price
```

---

### municipalities — Geographic Data

Schema: `municipality`  
Dataset: `demo-geo`

Fields: `code`, `name`, `county`, `countryCode`, `population`, `areaKm2`, `populationDensity`, `latitude`, `longitude`, `type`

Example query:
```
FROM municipality WHERE type == urban ORDER BY population DESC LIMIT 5
```

---

### companies — Business Directory

Schema: `company`  
Dataset: `demo-companies`

Fields: `registrationNumber`, `name`, `slug`, `industry`, `founded`, `employees`, `revenue`, `country`, `city`, `website`, `description`, `listed`

Example query:
```
FROM company WHERE listed == true ORDER BY revenue DESC
```
