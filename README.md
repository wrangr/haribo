# haribo

[![Build Status](https://magnum.travis-ci.com/wrangr/haribo.svg?token=4uyuoxi9qhvAfjzUTB6y&branch=master)](https://magnum.travis-ci.com/wrangr/haribo)

## CLI

```sh
npm install -g haribo
```

```sh
Usage: haribo [ options ] <url>

Options:

--out=</path/to/file>  Write HAR file to given path.
--max=<int>            Maximum number of pages to fetch.
--include=<pattern>    Include URLs mathing given pattern.
--exclude=<pattern>    Exclude URLs mathing given pattern.
-h, --help             Show this help.
-v, --version          Show version.

wrangr 2015
```

## Programmatically

```sh
npm install --save haribo
```

```js
var haribo = require('haribo');

haribo({ url: 'http://example.com/' })
  .on('error', function (err) {})
  .on('har', function (har) {})
  .on('end', function () {
    // Done!
  })
```
