'use strict';

var path      = require('path');
var gulp      = require('gulp');
var cssnano   = require('gulp-cssnano');
var htmlmin   = require('gulp-htmlmin');
var minify    = require('gulp-minify');
var smoosher  = require('gulp-smoosher');
var rename    = require('gulp-rename');
var clean     = require('gulp-clean');
var tap       = require('gulp-tap');
var sequence  = require('run-sequence');
var favicon   = require('gulp-base64-favicon');

var paths = {
  src         : './src',
  tmp         : './tmp',
  out         : './out',
  prod        : './..'
}

var gen = {
  prefix      : '#pragma once\n\nconst char HTML_DOC[] PROGMEM = "',
  suffix      : '";\n'
}

gulp.task('minify:js', function () {
  return gulp.src(path.join(paths.src, '*.js'))
  .pipe(minify({
    ext: {
      src: '-src.js',
      min: '.js'
    },
  }))
  .pipe(gulp.dest(paths.tmp));
});

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

gulp.task('smoosh', ['minify:html', 'minify:css', 'minify:js'], function () {
  return gulp.src(path.join(paths.tmp, '*.html'))
  .pipe(favicon(paths))
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
  .pipe(tap(function(file) {
    var htmlDoc = path.basename(file.path).replace('.min.', '_').toUpperCase();
    var genPrefix = gen.prefix.replace('HTML_DOC', htmlDoc);
    var genContent = String(file.contents).replace(/"/g, '\\"');
    file.contents = new Buffer(genPrefix + genContent + gen.suffix);
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

gulp.task('make:prod', ['make'], function() {
  return gulp.src(path.join(paths.out, '*.h'))
  .pipe(gulp.dest(paths.prod));
});

gulp.task('default', ['make']);