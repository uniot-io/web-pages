'use strict'

const path = require('path')
const gulp = require('gulp')
const cssnano = require('cssnano')
const variableCompress = require('postcss-variable-compress')
const cleancss = require('gulp-clean-css')
const postcss = require('gulp-postcss')
const htmlmin = require('gulp-htmlmin')
const terser = require('gulp-terser')
const smoosher = require('gulp-smoosher')
const rename = require('gulp-rename')
const clean = require('gulp-clean')
const tap = require('gulp-tap')
const favicon = require('gulp-base64-favicon')
const gzip = require('gulp-gzip')

const paths = {
  src: './src',
  tmp: './tmp',
  out: './out',
  prod: './..'
}

const gen = {
  prefix: '#pragma once\n\nconst char {{HTML_DOC}}[] PROGMEM = "',
  suffix: '";\n'
}

const genGz = {
  prefix:
    '#pragma once\n\n#define {{HTML_DOC}}_LENGTH {{LENGTH_PARAM}}\n\nconst unsigned char {{HTML_DOC}}[] PROGMEM = {',
  suffix: '\n};\n'
}

gulp.task('minify:js', () => {
  return gulp
    .src(path.join(paths.src, '*.js'))
    .pipe(
      terser({
        compress: {
          passes: 3,
          hoist_vars: true,
          hoist_funs: true
        },
        output: {
          comments: false
        }
      })
    )
    .pipe(gulp.dest(paths.tmp))
})

gulp.task('minify:css', () => {
  return gulp
    .src(path.join(paths.src, '*.css'))
    .pipe(
      postcss([
        variableCompress(),
        cssnano({
          preset: [
            'advanced',
            {
              discardComments: {
                removeAll: true
              }
            }
          ]
        })
      ])
    )
    .pipe(
      cleancss({
        level: {
          2: {
            all: true
          }
        }
      })
    )
    .pipe(gulp.dest(paths.tmp))
})

gulp.task('minify:html', () => {
  return gulp
    .src(path.join(paths.src, '*.html'))
    .pipe(
      htmlmin({
        collapseWhitespace: true,
        removeComments: false, // needed for smoosher templates
        minifyCSS: false
      })
    )
    .pipe(gulp.dest(paths.tmp))
})

gulp.task(
  'smoosh',
  gulp.series('minify:html', 'minify:css', 'minify:js', () => {
    return gulp
      .src(path.join(paths.tmp, '*.html'))
      .pipe(favicon(paths))
      .pipe(smoosher())
      .pipe(
        rename({
          suffix: '.min'
        })
      )
      .pipe(gulp.dest(paths.tmp))
  })
)

gulp.task(
  'gzip',
  gulp.series('smoosh', () => {
    return gulp.src(path.join(paths.tmp, '*.min.html')).pipe(gzip()).pipe(gulp.dest(paths.tmp))
  })
)

gulp.task('clean:tmp', () => {
  return gulp
    .src(paths.tmp, {
      read: false,
      allowEmpty: true
    })
    .pipe(clean())
})

gulp.task('clean:out', () => {
  return gulp
    .src(paths.out, {
      read: false,
      allowEmpty: true
    })
    .pipe(clean())
})

gulp.task(
  'build:gzip',
  gulp.series('gzip', () => {
    return gulp
      .src(path.join(paths.tmp, '*.min.html.gz'))
      .pipe(
        tap(function (file) {
          const htmlDoc = path.basename(file.path).replace(/\./g, '_').toUpperCase()
          const genPrefix = genGz.prefix
            .replace(/{{HTML_DOC}}/g, htmlDoc)
            .replace(/{{LENGTH_PARAM}}/g, file.contents.length)
          let genContent = ''
          for (let i = 0; i < file.contents.length; i++) {
            if (i > 0) {
              genContent += ', '
            }
            if (i % 20 === 0) {
              genContent += '\n  '
            }
            genContent += '0x' + ('00' + file.contents[i].toString(16)).slice(-2)
          }
          file.contents = Buffer.from(genPrefix + genContent + genGz.suffix)
        })
      )
      .pipe(
        rename({
          extname: '.gz.h'
        })
      )
      .pipe(gulp.dest(paths.out))
  })
)

gulp.task('make', gulp.series('clean:tmp', 'clean:out', 'build:gzip'))

gulp.task(
  'make:prod',
  gulp.series('make', () => {
    return gulp.src(path.join(paths.out, '*.h')).pipe(gulp.dest(paths.prod))
  })
)

gulp.task('default', gulp.series('make'))
