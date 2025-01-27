import { readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';

const tmpDir = os.tmpdir();

// https://gs.statcounter.com/screen-resolution-stats
const viewportSizes = {
  'Mobile 360x800': { width: 360, height: 800 },
  'Mobile 375x812': { width: 375, height: 812 },
  'Mobile 390x844': { width: 390, height: 844 },
  'Mobile 393x873': { width: 393, height: 873 },
  'Mobile 412x915': { width: 412, height: 915 },
  'Desktop 1280x720': { width: 1280, height: 720 },
  'Desktop 1366x768': { width: 1366, height: 768 },
  'Desktop 1440x900': { width: 1440, height: 900 },
  'Desktop 1536x864': { width: 1536, height: 864 },
  'Desktop 1920x1080': { width: 1920, height: 1080 },
  'Tablet 768x1024': { width: 768, height: 1024 },
  'Tablet 810x1080': { width: 810, height: 1080 },
  'Tablet 820x1180': { width: 820, height: 1180 },
  'Tablet 1280x800': { width: 1280, height: 800 },
  'Tablet 800x1280': { width: 800, height: 1280 },
};

export const createHar = async (url, opts = {}) => {
  const browser = await playwright.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    // headless: chromium.headless,
    headless: true,
  });

  const harFile = path.join(tmpDir, btoa(url));
  const context = await browser.newContext({
    recordHar: {
      path: harFile,
      mode: 'full',
    },
  });
  const page = await context.newPage();

  context.setDefaultTimeout(2 * 60 * 1000);

  page.setViewportSize({ width: 1920, height: 1080 });

  if (typeof opts.routes === 'object') {
    Object.keys(opts.routes).forEach((key) => {
      page.route(key, async (route) => {
        const handler = opts.routes[key];
        if (typeof handler === 'function') {
          await handler(route);
          return;
        }
        await route.fulfill(handler);
      });
    });
  }

  await page.goto(url);
  await page.waitForLoadState('load');
  await page.waitForTimeout(opts.delay || 0);

  const renderedHtml = await page.evaluate(
    () => document.documentElement.outerHTML,
  );

  const links = await page.$$eval('a', as => as.map(a => ({
    title: a.title,
    href: a.href,
    text: a.innerText,
    target: a.target,
    rel: a.rel,
    download: a.download,
    referrerpolicy: a.referrerPolicy,
    type: a.type,
  })));

  const screenshots = (
    !opts.screenshots
      ? null
      : await Promise.all(Object.keys(viewportSizes).map(async (key) => {
        const { width, height } = viewportSizes[key];
        page.setViewportSize({ width, height });
        return {
          key,
          value: (await page.screenshot()).toString('base64'),
        };
      }))
  );

  await context.close();
  await page.close();
  await browser.close();

  const har = await readFile(harFile, 'utf8');

  await unlink(harFile);

  const harJson = JSON.parse(har);

  return {
    ...harJson,
    log: {
      ...harJson.log,
      pages: [
        {
          ...harJson.log.pages[0],
          _url: url,
          _renderedHtml: renderedHtml,
          _links: links,
          ...(screenshots && {
            _screenshots: screenshots.reduce(
              (memo, { key, value }) => ({ ...memo, [key]: value }),
              {},
            ),
          }),
        },
      ],
    },
  };
};
