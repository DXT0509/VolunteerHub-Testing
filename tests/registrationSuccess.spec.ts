import { expect, type Page } from '@playwright/test';
import { test } from './support/flakyTest';

// Kịch bản kiểm thử (Test plan):
// 1) Truy cập trực tiếp /registration-success mà không có cờ => người dùng bị chuyển hướng về '/'
// 2) Đi qua luồng thực tế từ BeVolunteerForm: đăng nhập giả lập, mock API sự kiện + đăng ký, bấm submit
//    - Trang phải chuyển sang /registration-success
//    - Hiển thị nội dung thành công
//    - Nút 'Về trang chủ' đưa người dùng về '/'

const BASE = 'http://localhost:5173';

function createValidJwtToken(expOffsetSeconds = 3600) {
  const encodeBase64Url = (value: string) => btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = encodeBase64Url(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }));
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

async function mockRegistrationSubmit(page: Page, eventId: number) {
  let pendingRoute: any = null;

  await page.route(`http://localhost:4000/registrations/${eventId}/register`, (route) => {
    pendingRoute = route;
  });

  return {
    async fulfill() {
      if (!pendingRoute) {
        throw new Error('Expected a pending registration request but none was captured.');
      }
      await pendingRoute.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    },
  };
}

function makeEvent(overrides: Partial<any> = {}) {
  return {
    id: 101,
    title: 'Community Cleanup Day',
    name: 'Community Cleanup Day',
    ...overrides,
  };
}

test.describe('RegistrationSuccess page', () => {
  test('redirects to / when accessed directly without session flag or state', async ({ page }) => {
    await page.goto(`${BASE}/registration-success`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/$/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/$/);
  });

  test('shows success when the user submits the BeVolunteerForm successfully', async ({ page }) => {
    await setAuthState(page, {
      id: 7,
      full_name: 'Submit User',
      email: 'submit@example.com',
      phone: '0903333333',
    });
    await mockEventDetail(page, 101, makeEvent());

    const submitMock = await mockRegistrationSubmit(page, 101);

    await page.goto(`${BASE}/bevolunteer/101`, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /Đăng ký Làm Tình Nguyện Viên|Apply as Volunteer/i })).toBeVisible();
    await page.getByRole('button', { name: /Submit registration|Đăng ký/i }).click();

    await submitMock.fulfill();
    await page.waitForURL(/\/registration-success$/, { timeout: 6000 });

    await expect(page.getByRole('heading', { name: /Success/ })).toBeVisible();
    await expect(page.getByText(/Volunteer application submitted successfully!/i)).toBeVisible();

    // Clicking the button navigates home
    await page.getByRole('button', { name: /Về trang chủ|take me home/i }).click();
    await page.waitForURL(/\/$/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/$/);
  });
});
