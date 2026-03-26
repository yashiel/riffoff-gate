import { test, expect } from "@playwright/test";

/**
 * Design consistency tests — verifies the gate app's visual tokens
 * match the main app's dark theme palette for a cohesive brand feel.
 *
 * Main app dark theme reference (from musicticketing globals.css):
 *   --background: #08080a
 *   --foreground: #f4f4f6
 *   --card: #0f0f12
 *   --muted: #16161a
 *   --muted-foreground: #6b6b7a
 *   --coral: #BFFF00 (dark mode accent)
 *
 * Gate app tokens (from riffoff-gate globals.css):
 *   --background: #0a0a0c
 *   --foreground: #f4f4f6
 *   --card: #111113
 *   --muted: #1a1a1e
 *   --muted-foreground: #71717a
 *   --coral: #bfff00
 */

test.describe("Design Consistency with Main App", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // ─── Color Tokens ───────────────────────────────────

  test("accent color (--coral) matches main app", async ({ page }) => {
    const coral = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--coral")
        .trim()
    );
    // Both apps should use #bfff00 / #BFFF00 for dark-mode accent
    expect(coral.toLowerCase()).toBe("#bfff00");
  });

  test("foreground color matches main app dark theme", async ({ page }) => {
    const fg = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--foreground")
        .trim()
    );
    expect(fg).toBe("#f4f4f6");
  });

  test("background is very dark (close to main app)", async ({ page }) => {
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim()
    );
    // Gate: #0a0a0c, Main: #08080a — both are near-black (acceptable)
    expect(bg).toMatch(/#0[89a]0[89a]0[a-f0-9]/i);
  });

  test("destructive color uses standard red", async ({ page }) => {
    const destructive = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--destructive")
        .trim()
    );
    expect(destructive.toLowerCase()).toBe("#ef4444");
  });

  test("success color uses standard green", async ({ page }) => {
    const success = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--success")
        .trim()
    );
    expect(success.toLowerCase()).toBe("#10b981");
  });

  test("warning color uses standard amber", async ({ page }) => {
    const warning = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--warning")
        .trim()
    );
    expect(warning.toLowerCase()).toBe("#f59e0b");
  });

  // ─── Typography ─────────────────────────────────────

  test("body font uses system-ui stack (PWA-appropriate)", async ({
    page,
  }) => {
    const fontFamily = await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily
    );
    // Gate app uses system-ui for performance on mobile
    // This is intentionally different from main app's custom fonts
    // (Bebas Neue / Outfit) for PWA loading speed
    expect(fontFamily).toContain("system-ui");
  });

  // ─── Branding ───────────────────────────────────────

  test("logo uses coral accent for 'Riff'", async ({ page }) => {
    const heading = page.getByRole("heading", { level: 1 });
    const riffSpan = heading.locator("span").first();
    const color = await riffSpan.evaluate((el) =>
      getComputedStyle(el).color
    );
    // Should be the coral color (#bfff00) rendered as rgb
    expect(color).toMatch(/rgb\(191, 255, 0\)/);
  });

  test("logo includes 'Gate' suffix to differentiate from main app", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Gate"
    );
  });

  // ─── Touch Targets ──────────────────────────────────

  test("PIN input meets 44px minimum touch target", async ({ page }) => {
    await page.getByRole("button", { name: /enter pin/i }).click();
    const input = page.getByLabel("Gate PIN");
    const box = await input.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("Connect button meets 44px minimum touch target", async ({ page }) => {
    await page.getByRole("button", { name: /enter pin/i }).click();
    const btn = page.getByRole("button", { name: "Connect" });
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("mode toggle buttons are large enough for touch", async ({ page }) => {
    const qrBtn = page.getByRole("button", { name: /scan qr/i });
    const box = await qrBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(36);
  });

  // ─── Dark Mode Only ─────────────────────────────────

  test("no light mode toggle exists (dark-only app)", async ({ page }) => {
    // Gate app should NOT have a theme toggle — it's dark-only for camera contrast
    const themeToggle = page.locator(
      'button[aria-label*="light"], button[aria-label*="theme"]'
    );
    await expect(themeToggle).toHaveCount(0);
  });

  // ─── Antialiasing ───────────────────────────────────

  test("text rendering uses antialiasing", async ({ page }) => {
    const webkit = await page.evaluate(() =>
      getComputedStyle(document.body).getPropertyValue(
        "-webkit-font-smoothing"
      )
    );
    expect(webkit).toBe("antialiased");
  });

  // ─── Viewport Behaviour ─────────────────────────────

  test("no horizontal overflow (mobile-first)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const viewportWidth = 375;
    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
  });

  test("user-select is disabled (prevents accidental selection during scanning)", async ({
    page,
  }) => {
    const userSelect = await page.evaluate(() =>
      getComputedStyle(document.body).userSelect
    );
    expect(userSelect).toBe("none");
  });
});
