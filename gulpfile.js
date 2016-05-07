'use strict';

var path      = require('path');
var gulp      = require('gulp');
var cssnano   = require('gulp-cssnano');
var htmlmin   = require('gulp-htmlmin');
var smoosher  = require('gulp-smoosher');
var rename    = require('gulp-rename');
var replace   = require('gulp-replace');
var insert    = require('gulp-insert');
var clean     = require('gulp-clean');
var sequence  = require('run-sequence');

var paths = {
  src         : './src',
  tmp         : './tmp',
  out         : './out'
}

var gen = {
  prefix      : '#pragma once\n\nconst char HTML_DOC[] PROGMEM = "',
  suffix      : '";'
}

gulp.task('minify:css', function() {
  return gulp.src(path.join(paths.src, '*.css'))
  .pipe(cssnano())
  .pipe(gulp.dest(paths.tmp));
});

gulp.task('minify:html', function() {
  return gulp.src(path.join(paths.src, '*.html'))
  .pipe(htmlmin({
    collapseWhitespace: true,
    removeComments: false,    // needed for smoosher templates
    minifyCSS: false          // because cssnano is smarter than clean-css that is in htmlmin
  }))
  .pipe(gulp.dest(paths.tmp))
});

gulp.task('smoosh', ['minify:html', 'minify:css'], function() {
  return gulp.src(path.join(paths.tmp, '*.html'))
  .pipe(smoosher())
  .pipe(rename({
    suffix: '.min'
  }))
  .pipe(gulp.dest(paths.tmp));
});

gulp.task('clean:tmp', function() {
  return gulp.src(paths.tmp, {
    read: false
  })
  .pipe(clean());
});

gulp.task('clean:out', function() {
  return gulp.src(paths.out, {
    read: false
  })
  .pipe(clean());
});

gulp.task('build', ['smoosh'], function() {
  gulp.src(path.join(paths.tmp, '*.min.html'))
  .pipe(replace('"', '\\"'))
  .pipe(insert.wrap(gen.prefix, gen.suffix))
  .pipe(rename({
    extname: '.h'
  }))
  .pipe(gulp.dest(paths.out));
});

gulp.task('default', function(call) {
  sequence(
    ['clean:tmp', 'clean:out'],
    'build',
    call);
});