# Visual Regression Baselines

The first screenshots are not generated automatically. A human reviewer must approve the visual direction, representative data, and target environment first.

Use a stable local, staging, or UAT environment and then run:

```bash
PLAYWRIGHT_BASE_URL=https://your-approved-environment \
VISUAL_BASELINE_APPROVED=true \
npm run test:visual:update
```

Review the generated screenshots before committing them. Later runs use the same environment/data assumptions with `npm run test:visual`.

Expand the suite one approved page group at a time, including the route's loading, empty, error, and role-appropriate states when the test environment can provide them.
