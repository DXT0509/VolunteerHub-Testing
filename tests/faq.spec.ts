import { test, expect } from '@playwright/test';

const FAQ_ROUTE = '/support';

const FAQ_TEXT = {
  title: 'Frequently Asked Questions',
  heroDesc:
    "First time using VolunteerHub? Don't worry! Here are some frequently asked questions.",
  heading: 'Facts & Questions',
  lead: 'Sample text. Click to select the text box.',
  communityLink: 'Community Page',
  youtubeLink: 'YouTube Channel',
  sections: {
    gettingStarted: {
      title: 'Getting Started',
      items: [
        {
          q: 'How do I register an account?',
          a: 'Click Register, fill in your information and confirm.',
        },
      ],
    },
    features: {
      title: 'Features',
      items: [
        {
          q: 'What is the notification bell?',
          a:
            'The notification bell helps you receive the latest notifications related to your account, such as new posts, new comments, registration status updates, and other important alerts.',
        },
      ],
    },
  },
  links: {
    community: 'https://www.facebook.com/thainguyenzeno',
    youtube: 'https://www.youtube.com/@xt-aorongmobile9890',
  },
};

test.describe('Support Page (FAQ)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(FAQ_ROUTE);
  });

  test('renders hero content and headings', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: FAQ_TEXT.title })
    ).toBeVisible();
    await expect(page.getByText(FAQ_TEXT.heroDesc)).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: FAQ_TEXT.heading })
    ).toBeVisible();
    await expect(page.getByText(FAQ_TEXT.lead)).toBeVisible();
  });

  test('renders hero external links', async ({ page }) => {
    const communityLink = page.getByRole('link', {
      name: FAQ_TEXT.communityLink,
    });
    const youtubeLink = page.getByRole('link', {
      name: FAQ_TEXT.youtubeLink,
    });

    await expect(communityLink).toHaveAttribute('href', FAQ_TEXT.links.community);
    await expect(youtubeLink).toHaveAttribute('href', FAQ_TEXT.links.youtube);
  });

  test('accordion defaults to collapsed state', async ({ page }) => {
    const firstQuestion = page.getByRole('button', {
      name: FAQ_TEXT.sections.gettingStarted.items[0].q,
    });
    const secondQuestion = page.getByRole('button', {
      name: FAQ_TEXT.sections.features.items[0].q,
    });

    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false');
    await expect(secondQuestion).toHaveAttribute('aria-expanded', 'false');
  });

  test('accordion expands and collapses with content visibility', async ({ page }) => {
    const question = page.getByRole('button', {
      name: FAQ_TEXT.sections.gettingStarted.items[0].q,
    });
    const answerRegion = page.getByRole('region', {
      name: FAQ_TEXT.sections.gettingStarted.items[0].q,
    });
    const answerText = page.getByText(FAQ_TEXT.sections.gettingStarted.items[0].a);

    await expect(question).toHaveAttribute('aria-expanded', 'false');
    await expect(answerRegion).toBeHidden();

    await question.click();
    await expect(question).toHaveAttribute('aria-expanded', 'true');
    await expect(answerRegion).toBeVisible();
    await expect(answerText).toBeVisible();

    await question.click();
    await expect(question).toHaveAttribute('aria-expanded', 'false');
    await expect(answerRegion).toBeHidden();
  });

  test('keyboard interaction toggles accordion', async ({ page }) => {
    const question = page.getByRole('button', {
      name: FAQ_TEXT.sections.features.items[0].q,
    });
    const answerRegion = page.getByRole('region', {
      name: FAQ_TEXT.sections.features.items[0].q,
    });

    await question.focus();
    await page.keyboard.press('Enter');

    await expect(question).toHaveAttribute('aria-expanded', 'true');
    await expect(answerRegion).toBeVisible();
  });

  test.describe('responsive sanity', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('renders core content on mobile', async ({ page }) => {
      await expect(
        page.getByRole('heading', { level: 1, name: FAQ_TEXT.title })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: FAQ_TEXT.heading })
      ).toBeVisible();
      await expect(
        page.getByRole('button', {
          name: FAQ_TEXT.sections.gettingStarted.items[0].q,
        })
      ).toBeVisible();
    });
  });
});