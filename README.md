# haribo

[![Node.js CI](https://github.com/wrangr/haribo/actions/workflows/node.js.yml/badge.svg)](https://github.com/wrangr/haribo/actions/workflows/node.js.yml)

This is **experimental**: it will change and its probably broken.

## CLI

```sh
npm install -g haribo
```

```
Usage: haribo <url> [ options ]

Options:

--delay=0              Milliseconds to wait after page loads to get rendered
                       source and screenshots. (Defaul: `0`)
--screenshots          Include screenshots. (Defaul: `false`)
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
