import gulp from 'gulp';
import plumber from 'gulp-plumber';
import sourcemap from 'gulp-sourcemaps';
import postcss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

export default function css() {
	const SRC_DIR = process.srcDir;
	const DEST_DIR = process.destDir;

	return gulp
		.src(`${SRC_DIR}/**/*.css`)
		.pipe(plumber())
		.pipe(sourcemap.init())
		.pipe(postcss([autoprefixer(), cssnano({preset: 'default'})]))
		.pipe(sourcemap.write('.'))
		.pipe(gulp.dest(`${DEST_DIR}`));
}
