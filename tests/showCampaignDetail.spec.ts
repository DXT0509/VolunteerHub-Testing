import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

function createValidJwtToken(expOffsetSeconds = 3600) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds })).toString('base64url');
  return `${header}.${payload}.signature`;
}

async function setAuthState(page: Page, user: any, token = createValidJwtToken()) {
  await page.addInitScript(({ tokenValue, userValue }) => {
    localStorage.setItem('token', tokenValue);
    localStorage.setItem('user', userValue);
  }, {
    tokenValue: token,
    userValue: JSON.stringify(user),
  });
}

async function mockEventDetail(page: Page, eventId: number, eventData: any, status = 200) {
  await page.route(`http://localhost:4000/events/${eventId}`, (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(eventData),
    })
  );
}

async function mockMyRegistrations(page: Page, registrations: any[] = []) {
  await page.route('http://localhost:4000/registrations/my', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(registrations),
    })
  );
}

async function mockDashboard(page: Page) {
  await page.route('http://localhost:4000/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ hot_events: [] }),
    })
  );
}

function makeActiveEvent(overrides: Partial<any> = {}) {
  const now = Date.now();
  return {
    id: 101,
    title: 'Community Cleanup Day',
    description: 'Join us to clean up local neighborhoods.',
    status: 'active',
    banner_url: 'https://example.com/event-101.jpg',
    category: { name: 'Community' },
    location: {
      name: 'Main Square',
      address_line: '123 Center St',
      district: 'District 1',
      province: 'HCMC',
      country: 'VN',
    },
    start_time: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
    capacity: 20,
    manager: { full_name: 'Manager One', email: 'manager@example.com' },
    ...overrides,
  };
}

test.describe('ShowCampaignDetail UI rendering', () => {
  test('valid /events/:id shows main blocks and CTA', async ({ page }) => {
    await setAuthState(page, {
      id: 7,
      full_name: 'Nguyen Van User',
      email: 'user@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, makeActiveEvent());
    await mockMyRegistrations(page, []);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });

    await expect(page.locator('.scd-container')).toBeVisible();
    await expect(page.locator('.scd-title')).toHaveText('Community Cleanup Day');

    const bannerImg = page.locator('img.scd-img');
    await expect(bannerImg).toBeVisible();
    await expect(bannerImg).toHaveAttribute('alt', 'Community Cleanup Day');

    await expect(page.locator('.scd-desc')).toContainText('Join us to clean up local neighborhoods.');
    await expect(page.getByText(/Thể loại|category/i)).toBeVisible();
    await expect(page.getByText(/Địa điểm|location/i)).toBeVisible();
    await expect(page.getByText(/Số TNV còn thiếu|Missing volunteers/i)).toBeVisible();
    await expect(page.locator('.scd-label', { hasText: /Người quản lý|manager/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Đăng ký tham gia|register/i })).toBeVisible();
  });

  test('invalid id navigates back to home', async ({ page }) => {
    await setAuthState(page, {
      id: 9,
      full_name: 'Nguyen Van Invalid',
      email: 'invalid@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 999, { error: 'Not found' }, 404);
    await mockMyRegistrations(page, []);
    await mockDashboard(page);

    await page.goto(`${BASE}/events/999`, { waitUntil: 'networkidle' });
    await page.waitForURL(/\/$/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/$/);
  });

  test('API 500 navigates back to home gracefully', async ({ page }) => {
    await setAuthState(page, {
      id: 10,
      full_name: 'Nguyen Van Error',
      email: 'error@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 500, { error: 'HTTP 500' }, 500);
    await mockMyRegistrations(page, []);
    await mockDashboard(page);

    await page.goto(`${BASE}/events/500`, { waitUntil: 'networkidle' });
    await page.waitForURL(/\/$/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/$/);
  });

  test('missing optional fields still render without crashing', async ({ page }) => {
    await setAuthState(page, {
      id: 11,
      full_name: 'Nguyen Van Missing',
      email: 'missing@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, makeActiveEvent({
      banner_url: '',
      description: '',
      manager: { full_name: 'Manager One' },
    }));
    await mockMyRegistrations(page, []);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });

    await expect(page.locator('.scd-fallback')).toBeVisible();
    await expect(page.getByText(/Không có ảnh|no image/i)).toBeVisible();
    const desc = page.locator('.scd-desc');
    await expect(desc).toBeHidden();
    await expect(page.locator('.scd-details')).toBeVisible();
    await expect(page.locator('.scd-right')).toContainText('—');
  });

  test('very long description and location do not cause horizontal overflow', async ({ page }) => {
    const longText = 'Long description '.repeat(120);
    const longLocation = 'Very long location line, '.repeat(40);

    await setAuthState(page, {
      id: 12,
      full_name: 'Nguyen Van Long',
      email: 'long@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });

    await mockEventDetail(page, 101, makeActiveEvent({
      description: longText,
      location: {
        name: 'Central Plaza',
        address_line: longLocation,
        district: longLocation,
        province: longLocation,
        country: 'VN',
      },
    }));
    await mockMyRegistrations(page, []);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });

    await expect(page.locator('.scd-desc')).toContainText('Long description');
    await expect(page.locator('.scd-location')).toContainText('Central Plaza');

    const hasHorizontalOverflow = await page.locator('html').evaluate((el) => {
      const root = el as HTMLHtmlElement;
      return root.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBeFalsy();
  });
});

test.describe('ShowCampaignDetail data loading and states', () => {
  test('shows loading then renders data after API resolves', async ({ page }) => {
    await setAuthState(page, {
      id: 13,
      full_name: 'Nguyen Van Long',
      email: 'loading@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockMyRegistrations(page, []);

    // Intercept the event request and hold it until we verify the loading UI.
    let pendingRoute: any = null;
    await page.route('http://localhost:4000/events/101', (route) => {
      pendingRoute = route;
    });

    await page.goto(`${BASE}/events/101`, { waitUntil: 'domcontentloaded' });

    // Wait for the page to actually issue the event detail request, then
    // assert the loading UI. This avoids races where navigation/redirects
    // cause the loading text to appear briefly or on a different route.
    await page.waitForRequest('**/events/101', { timeout: 2000 });
    await expect(page.getByText(/Đang tải|loading/i)).toBeVisible();

    // Fulfill the intercepted request to let the page render the event.
    await pendingRoute.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeActiveEvent()),
    });

    await expect(page.locator('.scd-title')).toHaveText('Community Cleanup Day');
  });

  test('refreshing /events/:id reloads data correctly', async ({ page }) => {
    await setAuthState(page, {
      id: 14,
      full_name: 'Nguyen Van Refresh',
      email: 'refresh@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, makeActiveEvent());
    await mockMyRegistrations(page, []);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });
    await expect(page.locator('.scd-title')).toHaveText('Community Cleanup Day');

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('.scd-title')).toHaveText('Community Cleanup Day');
  });

  test('slow API keeps loading visible until data arrives', async ({ page }) => {
    await setAuthState(page, {
      id: 15,
      full_name: 'Nguyen Van Slow',
      email: 'slow@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockMyRegistrations(page, []);

    let pendingRoute: any = null;
    await page.route('http://localhost:4000/events/101', (route) => {
      pendingRoute = route;
    });

    await page.goto(`${BASE}/events/101`, { waitUntil: 'domcontentloaded' });

    await page.waitForRequest('**/events/101', { timeout: 2000 });
    await expect(page.getByText(/Đang tải|loading/i)).toBeVisible();

    await pendingRoute.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeActiveEvent()),
    });

    await expect(page.locator('.scd-title')).toHaveText('Community Cleanup Day');
  });

  test('empty event payload redirects to home', async ({ page }) => {
    await setAuthState(page, {
      id: 16,
      full_name: 'Nguyen Van Empty',
      email: 'empty@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, {});
    await mockMyRegistrations(page, []);
    await mockDashboard(page);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });
    await page.waitForURL(/\/$/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('ShowCampaignDetail CTA and functional', () => {
  test('clicking register navigates to /bevolunteer/:id', async ({ page }) => {
    await setAuthState(page, {
      id: 17,
      full_name: 'Nguyen Van CTA',
      email: 'cta@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, makeActiveEvent());
    await mockMyRegistrations(page, []);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /Đăng ký tham gia|register/i }).click();
    await expect(page).toHaveURL(/\/bevolunteer\/101$/);
  });

  test('approved registration opens cancel confirmation modal', async ({ page }) => {
    await setAuthState(page, {
      id: 18,
      full_name: 'Nguyen Van Approved',
      email: 'approved@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, makeActiveEvent());
    await mockMyRegistrations(page, [{ event_id: 101, status: 'approved' }]);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /Đã tham gia, hủy đăng ký|hủy đăng ký/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/Xác nhận hủy đăng ký tham gia sự kiện/i)).toBeVisible();
  });

  test('not logged in navigating to /events/:id redirects to /login', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });

    await page.goto(`${BASE}/events/101`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/login$/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test('not logged in navigating to /bevolunteer/:id redirects to /login', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    });

    await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/login$/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login$/);
  });

  test('ended event shows ended status and does not navigate to register', async ({ page }) => {
    await setAuthState(page, {
      id: 19,
      full_name: 'Nguyen Van Ended',
      email: 'ended@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    const endedEvent = makeActiveEvent({
      end_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    await mockEventDetail(page, 101, endedEvent);
    await mockMyRegistrations(page, []);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });

    const endedButton = page.getByRole('button', { name: /Sự kiện đã kết thúc|ended/i });
    await expect(endedButton).toBeVisible();
    await endedButton.click();
    await expect(page).toHaveURL(/\/events\/101$/);
  });

  test('pending registration shows pending button and opens cancel confirmation', async ({ page }) => {
    await setAuthState(page, {
      id: 20,
      full_name: 'Nguyen Van Pending',
      email: 'pending@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, makeActiveEvent());
    await mockMyRegistrations(page, [{ event_id: 101, status: 'pending' }]);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });

    const pendingBtn = page.getByRole('button', { name: /Đang chờ duyệt đăng ký|pending|Đang chờ/i });
    await expect(pendingBtn).toBeVisible();

    await pendingBtn.click();
    // should open the same confirmation dialog as cancel
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: /Xác nhận|Confirm|common.confirm/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Hủy|Cancel|common.cancel/i })).toBeVisible();
  });

  test('exchange channel button shows error when user not approved, navigates when approved', async ({ page }) => {
    // case: not approved
    await setAuthState(page, {
      id: 21,
      full_name: 'Nguyen Van NotApproved',
      email: 'noapprove@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, makeActiveEvent());
    await mockMyRegistrations(page, []);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });
    const exchangeBtn = page.getByRole('button', { name: /Truy cập kênh trao đổi|Truy cập|exchange/i }).first();
    await expect(exchangeBtn).toBeVisible();
    await exchangeBtn.click();
    // Expect warning toast to appear with not-joined message
    await expect(page.getByText(/Bạn chưa tham gia sự kiện|not joined|Bạn chưa tham gia/i)).toBeVisible();

    // case: approved -> navigate
    await mockMyRegistrations(page, [{ event_id: 101, status: 'approved' }]);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: /Truy cập kênh trao đổi|Truy cập|exchange/i }).first()).toBeVisible();
    await page.getByRole('button', { name: /Truy cập kênh trao đổi|Truy cập|exchange/i }).first().click();
    await page.waitForURL(/\/exchange-channel\/101$/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/exchange-channel\/101$/);
  });
});

test.describe('ShowCampaignDetail responsive and cross-browser', () => {
  test('desktop layout keeps two columns and CTA visible', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setAuthState(page, {
      id: 22,
      full_name: 'Nguyen Van Desktop',
      email: 'desktop@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, makeActiveEvent());
    await mockMyRegistrations(page, []);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });

    const left = page.locator('.scd-left');
    const right = page.locator('.scd-right');
    const cta = page.getByRole('button', { name: /Đăng ký tham gia|register/i });

    await expect(left).toBeVisible();
    await expect(right).toBeVisible();
    await expect(cta).toBeVisible();

    const leftBox = await left.boundingBox();
    const rightBox = await right.boundingBox();
    const ctaBox = await cta.boundingBox();

    expect(leftBox).toBeTruthy();
    expect(rightBox).toBeTruthy();
    expect(ctaBox).toBeTruthy();

    expect(leftBox!.x).toBeLessThan(rightBox!.x);
    expect(leftBox!.y).toBeLessThan(rightBox!.y + 80);
    expect(ctaBox!.width).toBeGreaterThan(180);

    const hasHorizontalOverflow = await page.locator('html').evaluate((el) => {
      const root = el as HTMLHtmlElement;
      return root.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBeFalsy();
  });

  test('tablet/mobile layout stacks into one column and CTA remains usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setAuthState(page, {
      id: 23,
      full_name: 'Nguyen Van Mobile',
      email: 'mobile@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, makeActiveEvent());
    await mockMyRegistrations(page, []);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });

    const left = page.locator('.scd-left');
    const right = page.locator('.scd-right');
    const cta = page.getByRole('button', { name: /Đăng ký tham gia|register/i });

    await expect(left).toBeVisible();
    await expect(right).toBeVisible();
    await expect(cta).toBeVisible();

    const leftBox = await left.boundingBox();
    const rightBox = await right.boundingBox();
    const ctaBox = await cta.boundingBox();

    expect(leftBox).toBeTruthy();
    expect(rightBox).toBeTruthy();
    expect(ctaBox).toBeTruthy();

    expect(rightBox!.y).toBeGreaterThan(leftBox!.y);
    expect(Math.abs(rightBox!.x - leftBox!.x)).toBeLessThan(40);

    const hasHorizontalOverflow = await page.locator('html').evaluate((el) => {
      const root = el as HTMLHtmlElement;
      return root.scrollWidth > window.innerWidth;
    });

    expect(hasHorizontalOverflow).toBeFalsy();
  });

  test('renders consistently across browser engines', async ({ page }, testInfo) => {
    await setAuthState(page, {
      id: 24,
      full_name: 'Nguyen Van CrossBrowser',
      email: 'cross@example.com',
      roles: [{ role: { name: 'VOLUNTEER' } }],
    });
    await mockEventDetail(page, 101, makeActiveEvent());
    await mockMyRegistrations(page, []);

    await page.goto(`${BASE}/events/101`, { waitUntil: 'networkidle' });

    await expect(page.locator('.scd-container')).toBeVisible();
    await expect(page.locator('.scd-title')).toHaveText('Community Cleanup Day');
    await expect(page.getByRole('button', { name: /Đăng ký tham gia|register/i })).toBeVisible();

    const browserName = testInfo.project.name;
    expect(['chromium', 'firefox', 'webkit']).toContain(browserName);

    const hasConsoleErrors: string[] = [];
    page.on('pageerror', (err) => hasConsoleErrors.push(err.message));
    expect(hasConsoleErrors).toEqual([]);
  });
});
