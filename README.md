# haribo

This is **experimental**: it will change and its probably broken.

## CLI

```sh
npm install -g haribo
```

```
Usage: haribo <url> [ options ]

Options:

--delay=0              Milliseconds to wait after page loads to get rendered
                       source and screenshots.
--screenshots          Include screenshots.
-h, --help             Show this help.
-v, --version          Show version.
```

## Programmatically

```sh
npm install haribo
```

```js
import { createHar } from 'haribo';

createHar('http://example.com/')
  .then((har) => {
    // ...
  })
  .catch((error) => {
    // ...
  })
```
