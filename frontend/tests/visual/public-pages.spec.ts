import { expect, test } from '@playwright/test';

const baselineApproved = process.env.VISUAL_BASELINE_APPROVED === 'true';

test.describe('approved public page baselines', () => {
  test.skip(!baselineApproved, 'A human must approve the visual direction and initial baseline before snapshot tests run.');

  for (const page of [
    { name: 'quick-registration', path: '/' },
    { name: 'manual-registration', path: '/register' },
  ]) {
    test(page.name, async ({ page: browserPage }) => {
      await browserPage.goto(page.path, { waitUntil: 'networkidle' });
      await expect(browserPage).toHaveScreenshot(`${page.name}.png`, { fullPage: true, animations: 'disabled' });
    });
  }
});
