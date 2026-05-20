import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:4173";

test.describe("Home page", () => {
  test("renders banner hero", async ({ page }) => {
    await page.goto(BASE);
    // Ensure at least one hero heading (carousel) is visible
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 5000 });
  });

  test("shows volunteer needs with mocked backend and SEE ALL button", async ({
    page,
  }) => {
    const mock = {
      hot_events: [
        {
          id: 1,
          banner_url: "https://example.com/img.jpg",
          title: "Event 1",
          description: "Test event",
          start_time: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          total_likes: 2,
          total_comments: 3,
        },
      ],
    };

    // Intercept the dashboard request used by VolunteerNeeds and return deterministic data
    await page.route("http://localhost:4000/dashboard", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mock),
      }),
    );

    // Intercept the image request to prevent loading error and state fallback
    await page.route("https://example.com/img.jpg", (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
          "base64"
        ),
      })
    );

    await page.goto(BASE);

    // VolunteerNeeds component uses a fallback string 'Volunteer Needs Now'
    await expect(page.getByRole('heading', { name: 'Volunteer Needs Now', exact: true })).toBeVisible({
      timeout: 5000,
    });

    // Card image alt is set to the event title
    await expect(page.locator('img[alt="Event 1"]')).toBeVisible();

    // The SEE ALL button (fallback 'SEE ALL') should exist
    await expect(page.getByRole("button", { name: /SEE ALL/i })).toBeVisible();
  });

  test("contact form fills and submits without navigating", async ({
    page,
  }) => {
    // Provide empty dashboard data to avoid noise
    await page.route("http://localhost:4000/dashboard", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ hot_events: [] }),
      }),
    );

    await page.goto(`${BASE}/#contact`);

    await page.fill("#contact-name", "Test User");
    await page.fill("#contact-email", "test@example.com");
    await page.fill("#contact-message", "Hello from Playwright test");

    await page.click('#contact button[type="submit"]');

    // Expect a feedback paragraph to appear inside the contact form
    const feedback = page.locator("#contact form p");
    await expect(feedback).toHaveCount(1, { timeout: 5000 });
    await expect(feedback.first()).not.toBeEmpty();
  });
});
