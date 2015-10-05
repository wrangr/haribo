var Gulp = require('gulp');
var Jshint = require('gulp-jshint');
var Mocha = require('gulp-mocha');


var internals = {
  files: [ 'gulpfile.js', 'index.js', 'lib/**/*.js', 'test/**/*.js' ]
};


Gulp.task('lint', function () {

  return Gulp.src(internals.files)
    .pipe(Jshint())
    .pipe(Jshint.reporter('jshint-stylish'));
});


Gulp.task('test', [ 'lint' ], function () {

  return Gulp.src('test/**/*.spec.js', { read: false }).pipe(Mocha());
});


Gulp.task('watch', function () {

  Gulp.watch(internals.files, [ 'test' ]);
});


Gulp.task('default', [ 'test' ]);

