'use strict';


const Gulp = require('gulp');
const Eslint = require('gulp-eslint');
const Mocha = require('gulp-mocha');


const internals = {
  files: ['gulpfile.js', 'index.js', 'lib/**/*.js', 'test/**/*.js']
};


Gulp.task('lint', () => {

  return Gulp.src(internals.files)
    .pipe(Eslint())
    .pipe(Eslint.format())
    .pipe(Eslint.failAfterError());
});


Gulp.task('test', ['lint'], () => {

  return Gulp.src('test/**/*.spec.js', { read: false }).pipe(Mocha());
});


Gulp.task('watch', () => {

  Gulp.watch(internals.files, ['test']);
});


Gulp.task('default', ['test']);

