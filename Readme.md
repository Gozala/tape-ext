# tape-ext

[![travis][travis.icon]][travis.url]
[![package][version.icon] ![downloads][downloads.icon]][package.url]
[![styled with prettier][prettier.icon]][prettier.url]

A command line tool (inspired by [tape][]) can be used to test Firefox [web extensions][].
It starts Firefox in [headless mode][] using [Web Driver][] and [install temporary][] test [web extensions][] that are assumed to produce [TAP][] output. You can use [libdweb][] experimental `test` API which is API compatible with [tape][] for writing tests.

## Usage

You can run test web extension by running `tape-ext` from it's directory (directory containing `manifest.json` file) or you could pass [glob][] to test multiple web-extensions.

```
tape-ext "test/*/manifest.json"
```

You can find usage examples at [libdweb][] repository.

[travis.icon]: https://travis-ci.com/Gozala/tape-ext.svg?branch=master
[travis.url]: https://travis-ci.com/Gozala/tape-ext
[version.icon]: https://img.shields.io/npm/v/tape-ext.svg
[package.url]: https://npmjs.org/package/tape-ext
[downloads.icon]: https://img.shields.io/npm/dm/tape-ext.svg
[downloads.url]: https://npmjs.org/package/tape-ext
[prettier.icon]: https://img.shields.io/badge/styled_with-prettier-ff69b4.svg
[prettier.url]: https://github.com/prettier/prettier
[tape]: https://github.com/substack/tape
[web extensions]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions
[glob]: https://www.npmjs.com/package/glob
[headless mode]: https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode
[web driver]: https://developer.mozilla.org/en-US/docs/Web/WebDriver
[install temporary]: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Temporary_Installation_in_Firefox
[tap]: https://testanything.org/
[libdweb]: https://github.com/mozilla/libdweb
