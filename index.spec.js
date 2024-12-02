import { describe, it, expect } from 'vitest';
import { createHar } from './index.js';

describe('createHar', () => {
  it('rejects when no URL', async () => {
    await expect(createHar()).rejects.toThrow(/expected string/);
  });

  it('rejects when URL not a string', async () => {
    await expect(createHar(new Date())).rejects.toThrow(/expected string/);
  });

  it('rejects when page fails to load', async () => {
    const url = 'https://example.com/';
    await expect(createHar(url, {
      routes: {
        [url]: request => request.abort(),
      },
    })).rejects.toThrow(/net::ERR_FAILED/);
  });

  it('resolves with har object', async () => {
    const url = 'https://example.com/';
    const html = '<html><body><a href="https://example.com">Example</a></body></html>';
    const result = await createHar(url, {
      routes: {
        [url]: {
          status: 200,
          contentType: 'text/html',
          body: html,
        },
      },
    });

    expect(result.log.version).toBe('1.2');
    expect(result.log.pages.length).toBe(1);
    expect(result.log.pages[0].pageTimings.onContentLoad).toBeGreaterThan(0);
    expect(result.log.pages[0].pageTimings.onLoad).toBeGreaterThan(0);
    expect(result.log.pages[0]._url).toBe(url);
    expect(result.log.pages[0]._links.length).toBe(1);
    expect(result.log.pages[0]._links[0].href).toBe(url);
    expect(result.log.pages[0]._links[0].text).toBe('Example');
  });
});
