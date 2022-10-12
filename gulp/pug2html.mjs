import gulp from 'gulp';
import plumber from 'gulp-plumber';
import pug from 'gulp-pug';
import pugLinter from 'gulp-pug-linter';

export default function pug2html() {
	const SRC_DIR = process.srcDir;
	const DEST_DIR = process.destDir;

	const pugOptions = {
		pretty: process.env.NODE_ENV !== 'production',
		basedir: process.rootDir
	};

	return gulp
		.src(`${SRC_DIR}/pages/**/*.pug`)
		.pipe(plumber())
		.pipe(pugLinter({reporter: 'default'}))
		.pipe(pug(pugOptions))
		.pipe(gulp.dest(`${DEST_DIR}`));
}
