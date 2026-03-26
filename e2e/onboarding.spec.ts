import { test, expect } from "@playwright/test";

test.describe("Onboarding Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  // ─── Page Structure ─────────────────────────────────

  test("renders the onboarding page with correct branding", async ({
    page,
  }) => {
    await expect(page).toHaveTitle("RiffOff Gate");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "RiffOff"
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Gate"
    );
    await expect(page.getByText("Scan the organiser's QR to start")).toBeVisible();
  });

  test("shows QR and PIN mode toggle buttons", async ({ page }) => {
    const qrButton = page.getByRole("button", { name: /scan qr/i });
    const pinButton = page.getByRole("button", { name: /enter pin/i });
    await expect(qrButton).toBeVisible();
    await expect(pinButton).toBeVisible();
  });

  test("QR mode is active by default", async ({ page }) => {
    const qrButton = page.getByRole("button", { name: /scan qr/i });
    // QR tab should have the active styling (shadow-sm class)
    await expect(qrButton).toHaveClass(/shadow-sm/);
  });

  // ─── Mode Switching ─────────────────────────────────

  test("can switch to PIN mode", async ({ page }) => {
    await page.getByRole("button", { name: /enter pin/i }).click();
    // PIN form should be visible
    await expect(page.getByLabel("Gate PIN")).toBeVisible();
    await expect(page.getByPlaceholder("000000")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect" })).toBeVisible();
  });

  test("can switch back to QR mode from PIN", async ({ page }) => {
    await page.getByRole("button", { name: /enter pin/i }).click();
    await expect(page.getByLabel("Gate PIN")).toBeVisible();

    await page.getByRole("button", { name: /scan qr/i }).click();
    await expect(page.getByLabel("Gate PIN")).not.toBeVisible();
  });

  // ─── PIN Onboarding ─────────────────────────────────

  test("PIN input only accepts alphanumeric characters", async ({ page }) => {
    await page.getByRole("button", { name: /enter pin/i }).click();
    const input = page.getByLabel("Gate PIN");
    // Use pressSequentially to trigger onChange handler which strips non-alnum
    await input.pressSequentially("abc!@#123", { delay: 30 });
    // Special chars should be stripped, remaining chars uppercased, limited to 6
    await expect(input).toHaveValue("ABC123");
  });

  test("PIN input is limited to 6 characters", async ({ page }) => {
    await page.getByRole("button", { name: /enter pin/i }).click();
    const input = page.getByLabel("Gate PIN");
    await input.fill("ABCDEFGH");
    await expect(input).toHaveValue("ABCDEF");
  });

  test("PIN input converts to uppercase", async ({ page }) => {
    await page.getByRole("button", { name: /enter pin/i }).click();
    const input = page.getByLabel("Gate PIN");
    await input.fill("abc123");
    await expect(input).toHaveValue("ABC123");
  });

  test("Connect button is disabled when PIN is less than 6 chars", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /enter pin/i }).click();
    const connectBtn = page.getByRole("button", { name: "Connect" });
    await expect(connectBtn).toBeDisabled();

    await page.getByLabel("Gate PIN").fill("12345");
    await expect(connectBtn).toBeDisabled();
  });

  test("Connect button is enabled when PIN is exactly 6 chars", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /enter pin/i }).click();
    await page.getByLabel("Gate PIN").fill("ABC123");
    const connectBtn = page.getByRole("button", { name: "Connect" });
    await expect(connectBtn).toBeEnabled();
  });

  test("Connect button stays disabled for short PIN (prevents submission)", async ({
    page,
  }) => {
    const pinBtn = page.getByRole("button", { name: /enter pin/i });
    await pinBtn.click();
    await expect(page.getByLabel("Gate PIN")).toBeVisible();
    const input = page.getByLabel("Gate PIN");
    await input.click();
    await input.fill("123");
    // Connect button should remain disabled for <6 chars
    await expect(
      page.getByRole("button", { name: "Connect" })
    ).toBeDisabled();
  });

  test("PIN input has correct accessibility attributes", async ({ page }) => {
    await page.getByRole("button", { name: /enter pin/i }).click();
    const input = page.getByLabel("Gate PIN");
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(input).toHaveAttribute("maxlength", "6");
    await expect(input).toHaveAttribute("autocomplete", "off");
    await expect(input).toHaveAttribute("spellcheck", "false");
  });

  test("API error clears when user modifies PIN input", async ({ page }) => {
    // Use 400 to avoid gateApi's 401/403 auto-logout
    await page.route("**/api/gate/auth/pin", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid PIN" }),
      })
    );

    await page.getByRole("button", { name: /enter pin/i }).click();
    await expect(page.getByLabel("Gate PIN")).toBeVisible();

    const input = page.getByLabel("Gate PIN");
    await input.fill("ABC123");
    await page.getByRole("button", { name: "Connect" }).click();
    await expect(page.getByText("Invalid PIN")).toBeVisible({ timeout: 5000 });

    // Modify input — error should clear via onChange
    await input.fill("ABC124");
    await expect(page.getByText("Invalid PIN")).not.toBeVisible();
  });

  test("shows error for invalid PIN when API returns error", async ({
    page,
  }) => {
    // Use 400 (not 401/403) to avoid gateApi's auto-logout redirect
    await page.route("**/api/gate/auth/pin", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid PIN. Please try again." }),
      })
    );

    await page.getByRole("button", { name: /enter pin/i }).click();
    await expect(page.getByLabel("Gate PIN")).toBeVisible();
    await page.getByLabel("Gate PIN").fill("WRONG1");
    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page.getByText("Invalid PIN. Please try again.")).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows rate limit message on 429 response", async ({ page }) => {
    await page.route("**/api/gate/auth/pin", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ retryAfter: 120 }),
      })
    );

    await page.getByRole("button", { name: /enter pin/i }).click();
    await expect(page.getByLabel("Gate PIN")).toBeVisible();
    await page.getByLabel("Gate PIN").fill("WRONG1");
    await page.getByRole("button", { name: "Connect" }).click();

    await expect(page.getByText(/too many attempts/i)).toBeVisible({ timeout: 5000 });
  });

  test("shows loading state during PIN submission", async ({ page }) => {
    // Delay the API response to observe loading state
    await page.route("**/api/gate/auth/pin", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid PIN" }),
      });
    });

    await page.getByRole("button", { name: /enter pin/i }).click();
    await page.getByLabel("Gate PIN").fill("ABC123");
    await page.getByRole("button", { name: "Connect" }).click();

    // Should show loading text
    await expect(page.getByText("Connecting...")).toBeVisible();
    // Input should be disabled during loading
    await expect(page.getByLabel("Gate PIN")).toBeDisabled();
  });

  test("redirects to /scan on successful PIN auth", async ({ page }) => {
    const mockSession = {
      sessionId: "test-session-123",
      eventId: "event-001",
      gateId: "gate-001",
      gateName: "Main Entrance",
      deviceId: "device-test",
    };

    await page.route("**/api/gate/auth/pin", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSession),
      })
    );

    await page.getByRole("button", { name: /enter pin/i }).click();
    await page.getByLabel("Gate PIN").fill("ABC123");
    await page.getByRole("button", { name: "Connect" }).click();

    await page.waitForURL("**/scan");
    expect(page.url()).toContain("/scan");
  });

  // ─── QR Onboarding ─────────────────────────────────

  test("QR mode shows camera error or permission denied in headless browser", async ({ page }) => {
    // In headless mode, camera access will fail — either "error" or "permission-denied" state
    await expect(
      page.getByText(/failed to start camera|allow camera access|check your device settings|check your browser settings/i)
    ).toBeVisible({ timeout: 10000 });
    // Should show a retry/try again button
    await expect(
      page.getByRole("button", { name: /try again|retry/i })
    ).toBeVisible();
  });

  // ─── Dark Theme ─────────────────────────────────────

  test("uses dark theme by default", async ({ page }) => {
    const bgColor = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );
    // Should be #0a0a0c or very close to black
    expect(bgColor).toMatch(/rgb\(10, 10, 12\)|rgba?\(10,\s*10,\s*12/);
  });

  // ─── Responsive Design ──────────────────────────────

  test("onboarding is centered on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    // Mode toggle should be visible and usable
    await expect(
      page.getByRole("button", { name: /scan qr/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /enter pin/i })
    ).toBeVisible();
  });
});
