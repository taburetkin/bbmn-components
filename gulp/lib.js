import gulp from 'gulp';
import sourcemaps from 'gulp-sourcemaps';
import rollup from 'gulp-rollup';
import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import size from 'gulp-size';
import json from 'rollup-plugin-json';

let babelConfig = {
	presets: [['env', { modules: false }]],
	babelrc: false,
	plugins: ['external-helpers']
};

let rollupGlobals = {
	'backbone': 'Backbone',
	'backbone.marionette': 'Mn',
	'jquery': '$',
	'underscore': '_',
	'bbmn-core': 'bbmn',
	'bbmn-utils': 'bbmn.utils',
};

let testExternals = ['backbone', 'backbone.marionette', 'underscore'];

let getRollupConfig = (format, babelcfg = babelConfig) => {

	return {
		allowRealFiles: true,
		plugins: [
			json(),
			resolve({
				module: true,
			}),
			babel(babelcfg)
		],
		external: ['backbone', 'backbone.marionette', 'underscore', "bbmn-core", "bbmn-utils"],
		output: {
			format,
			name: 'bbmn.components',
			'globals': rollupGlobals,
			exports: 'named',
		},
		input:'src/index.js'
	}
};

function lib(format) {
	let rollupConfig = getRollupConfig(format);
	gulp.src('src/index.js')
		.pipe(sourcemaps.init())
		// note that UMD and IIFE format requires `name` but it will be inferred from the source file name `mylibrary.js`
		.pipe(rollup(rollupConfig))
		// save sourcemap as separate file (in the same folder)
		.pipe(sourcemaps.write(''))
		.pipe(size())
		.pipe(gulp.dest('lib/' + format));
}

export function rollupForTest(name)
{
	let rollupConfig = getRollupConfig(name);
	rollupConfig.external = testExternals;
	gulp.src('src/index.js')
		.pipe(sourcemaps.init())
		// note that UMD and IIFE format requires `name` but it will be inferred from the source file name `mylibrary.js`
		.pipe(rollup(rollupConfig))
		// save sourcemap as separate file (in the same folder)
		.pipe(sourcemaps.write(''))
		.pipe(size())
		.pipe(gulp.dest('test/lib'));

}


gulp.task('lib-iife', () => lib('iife'));
gulp.task('lib-umd', ['lib-iife'], () => lib('umd'));
gulp.task('lib', ['lib-umd'], () => lib('es'));
