# haribo

This is **experimental**: it will change and its probably broken. 

[![Build Status](https://travis-ci.org/wrangr/haribo.svg?branch=master)](https://travis-ci.org/wrangr/haribo)
[![Dependency Status](https://david-dm.org/wrangr/haribo.svg?style=flat)](https://david-dm.org/wrangr/haribo)
[![devDependency Status](https://david-dm.org/wrangr/haribo/dev-status.png)](https://david-dm.org/wrangr/haribo#info=devDependencies)

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
