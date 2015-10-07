var Gulp = require('gulp');
var Eslint = require('gulp-eslint');
var Mocha = require('gulp-mocha');


var internals = {
  files: ['gulpfile.js', 'index.js', 'lib/**/*.js', 'test/**/*.js']
};


Gulp.task('lint', function () {

  return Gulp.src(internals.files)
    .pipe(Eslint())
    .pipe(Eslint.format())
    .pipe(Eslint.failAfterError());
});


Gulp.task('test', ['lint'], function () {

  return Gulp.src('test/**/*.spec.js', { read: false }).pipe(Mocha());
});


Gulp.task('watch', function () {

  Gulp.watch(internals.files, ['test']);
});


Gulp.task('default', ['test']);

