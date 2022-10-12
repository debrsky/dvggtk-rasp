import gulp from 'gulp';
import htmlmin from 'gulp-htmlmin';

export default function html() {
	const SRC_DIR = process.srcDir;
	const DEST_DIR = process.destDir;

	let stream = gulp.src(`${SRC_DIR}/**/*.html`);
	if (process.env.NODE_ENV === 'production')
		stream = stream.pipe(
			// https://github.com/kangax/html-minifier
			htmlmin({collapseWhitespace: true, conservativeCollapse: true})
		);

	return stream.pipe(gulp.dest(`${DEST_DIR}`));
}
