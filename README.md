# haribo

This is **experimental**: it will change and its probably broken.

[![Build Status](https://travis-ci.org/wrangr/haribo.svg?branch=master)](https://travis-ci.org/wrangr/haribo)
[![Dependency Status](https://david-dm.org/wrangr/haribo.svg?style=flat)](https://david-dm.org/wrangr/haribo)
[![devDependency Status](https://david-dm.org/wrangr/haribo/dev-status.png)](https://david-dm.org/wrangr/haribo#info=devDependencies)

## CLI

```sh
npm install -g haribo
```

```
Usage: haribo [ options ] <url>

Options:

--exclude=<pattern>    Exclude URLs mathing given pattern.
--include=<pattern>    Include URLs mathing given pattern.
--max=1                Maximum number of pages to fetch.
--delay=3              How long to wait after page loads to get rendered
                       source and screenshots.
--out=</path/to/file>  Write HAR file to given path.
--screenshot=false     Include screenshots.
--v-width=400          Viewport width.
--v-height=300         Viewport height.
-h, --help             Show this help.
-v, --version          Show version.

Wrangr 2015
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
