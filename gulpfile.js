'use strict';

var path      = require('path');
var gulp      = require('gulp');
var cssnano   = require('gulp-cssnano');
var htmlmin   = require('gulp-htmlmin');
var smoosher  = require('gulp-smoosher');
var rename    = require('gulp-rename');
var replace   = require('gulp-replace');    // gulp-replace is candidate for simplification by gulp-tap
var insert    = require('gulp-insert');     // gulp-insert is candidate for simplification by gulp-tap
var clean     = require('gulp-clean');
var tap       = require('gulp-tap');
var sequence  = require('run-sequence');

var paths = {
  src         : './src',
  tmp         : './tmp',
  out         : './out',
  prod        : './..'
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
  return gulp.src(path.join(paths.tmp, '*.min.html'))
  .pipe(replace('"', '\\"'))
  .pipe(insert.wrap(gen.prefix, gen.suffix))
  .pipe(tap(function(file) {
    var htmlDoc = path.basename(file.path).replace('.min.', '_').toUpperCase();
    file.contents = new Buffer(String(file.contents).replace('HTML_DOC', htmlDoc));
  }))
  .pipe(rename({
    extname: '.h'
  }))
  .pipe(gulp.dest(paths.out));
});

gulp.task('make', function(call) {
  sequence(
    ['clean:tmp', 'clean:out'],
    'build',
    call);
});

gulp.task('make:prod', ['make'], function(call) {
  return gulp.src(path.join(paths.out, '*.h'))
  .pipe(gulp.dest(paths.prod));
});

gulp.task('default', ['make']);