import gulp from 'gulp';
import mocha from 'gulp-mocha';
import registerBabel from './register-babel';
const mochaGlobals = ['stub', 'spy', 'expect', 'Mn'];

function _mocha(setupFile) {
	return gulp.src(
		[setupFile,'test/unit/**/*.js'], 
		{ read: false }
	)
		.pipe(mocha({
			reporter: 'dot',
			globals: mochaGlobals,
			ignoreLeaks: false,
		}));
}


export function test() {
	process.env.NODE_ENV = 'test';
	//registerBabel();
	return _mocha('test/setup.js');
}


gulp.task('test', test);
