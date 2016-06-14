// Gulpfile.js

var gulp = require('gulp'),
  del = require('del'),
  changed = require('gulp-changed');

gulp.task('clean', function (cb) {
  del(["./out/src"], cb);
});

gulp.task('assets', function () {
  var srcPath = "./src/**",
    destPath = "./out/src"

  return gulp.src(srcPath)
    .pipe(changed(destPath))
    .pipe(gulp.dest(destPath))
});

gulp.task('default', ['clean', 'assets']);
