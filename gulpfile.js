const gulp        = require('gulp');
const prefix      = require('gulp-autoprefixer');
const babel       = require('gulp-babel');
const gulpClean   = require('gulp-clean');
const cleanCSS    = require('gulp-clean-css');
const fileInclude = require('gulp-file-include');
const rename      = require('gulp-rename');
const gulpIf      = require('gulp-if');
const sass        = require('gulp-sass');
const uglifyJS    = require('gulp-uglify');
const mapStream   = require('map-stream');
const browserSync = require('browser-sync').create();

const packageInfo = require('./package.json');

let MODE = 'production';
let style = '';
let script = '';

gulp.task('serve', () => {
    browserSync
        .init({
            notify: false,
            open: false,
            reloadDelay: 100,
            files: [
                './build/**/*',
            ],
            server: {
                baseDir: './build',
            },
        });

    gulp.watch('src/**/*.html', gulp.series('html'));
    gulp.watch('src/**/*.scss', gulp.series('scss', 'html'));
    gulp.watch('src/**/*.js', gulp.series('js', 'html'));
});

gulp.task('html', function() {
    return gulp.src(MODE === 'development' ? 'src/development.html' : 'src/production.html')
        .pipe(rename('index.html'))
        .pipe(fileInclude({
            prefix: '{{',
            suffix: '}}',
            context: {
                name: packageInfo.name,
                version: packageInfo.version,
                style: style,
                script: script,
            },
        }))
        .pipe(gulp.dest('build'));
});

gulp.task('scss', function() {
    return gulp.src('src/**/*.scss')
        .pipe(sass())
        .pipe(prefix({
            browsers: ['> 0%'],
        }))
        .pipe(gulpIf(MODE === 'production', cleanCSS()))
        .pipe(mapStream(function(file, done) {
            style = file.contents.toString();
            done(null, file);
        }));
});

gulp.task('js', function() {
    return gulp.src('src/**/*.js')
        .pipe(babel({
            presets: [
                '@babel/env',
            ],
            plugins: [
                '@babel/plugin-proposal-class-properties',
            ],
        }))
        .pipe(gulpIf(MODE === 'production', uglifyJS()))
        .pipe(mapStream(function(file, done) {
            script = '(function(){' + file.contents.toString() + '})();';
            done(null, file);
        }));
});

gulp.task('flush', () =>
    gulp.src([
        'build/*',
    ], {
        read: false,
        allowEmpty: true,
        dot: true,
    })
        .pipe(gulpClean())
);

gulp.task('build', gulp.series(
    'flush',
    gulp.parallel(
        'scss',
        'js',
    ),
    'html',
));

gulp.task('dev', gulp.series(
    (done) => {
        MODE = 'development';
        done();
    },
    'build',
    'serve',
));

gulp.task('default', gulp.series('dev'));
