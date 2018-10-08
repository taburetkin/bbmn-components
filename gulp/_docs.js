import gulp from 'gulp';
import fs from 'fs';
import pathUtil from 'path';
import _ from 'underscore';
import gulpSequence from 'gulp-sequence';
import merge from 'merge-stream';
import concat from 'gulp-concat-util';
import del from 'del';

let rootPath = pathUtil.join('src');

function getFolders(dir) {
    return fs.readdirSync(dir)
      .filter(function(file) {
        return fs.statSync(pathUtil.join(dir, file)).isDirectory();
      });
}

function toRelative(filePath, skipFile){
	let fp = pathUtil.relative('src', filePath);
	let chunks = fp.split(/\/|\\/);
	if(skipFile) chunks.pop();
	return chunks.join('/');
}

function processFolder(folderPath, level = 1, tasks = []) {
	let normalizedFolder = folderPath.split('/');
	normalizedFolder.shift();
	normalizedFolder = normalizedFolder.join('/');
	tasks.push(
		gulp.src(folderPath + '/_README.md')
			.pipe(concat('README.md', {process: function(src, filePath){
				let dirPath = toRelative(filePath, true);
				let header = '## ' + dirPath + '\r\n';
				return header + src;
			}}))
			// .pipe(concat('README.md', { process: function(src, filePath){
			// 	let dirPath = toRelative(filePath, true);
			// 	console.log('~', dirPath, '	', normalizedFolder);
			// 	return src;
			// }}))
			.pipe(gulp.dest(folderPath))
	);
	let subFolders = getFolders(folderPath);
	_(subFolders).each(subFolder => processFolder(folderPath + '/' + subFolder, level + 1, tasks));
	return tasks;
}

function takeFolder(opts = {})
{
	let { path, parent, result } = opts;
	!path && (path = 'src');
	!result && (result = []);	
	const folder = {
		path,
		parent,		
	}
	folder.children = _(getFolders(path) || []).map(child => takeFolder({ path: path + '/' + child, parent: null }));
	return folder;
}

function removeSrc(path){
	let chunks = path.split('/');
	chunks.shift();
	return chunks.join('/');
}

function hasDocs(path){
	return fs.existsSync(path + '/README.md');
}

function buildTable(folder, level = 0){
	let result = '';
	_(folder.children).each(child => {
		//console.log('child', child.path, hasDocs(child.path));
		if(!hasDocs(child.path)) return;
		let name = removeSrc(child.path);
		let url = name.replace(/[^a-z0-9-\s]/gi,'').replace(/\s/gi,'-');
		let nameUrl = `[${name}](#${url})`;
		result += (level ? '\t'.repeat(level) : '') + '* ' + nameUrl + '\r\n';
		result += buildTable(child, level + 1);
	});
	return result;
}
function buildFolderReadme(folder){
	let promises = [];
	let folderName = removeSrc(folder.path);
	let table = '';
	if (folder.children.length) {
		promises = _(folder.children).map(child => buildFolderReadme(child));

	}
	let readmes  =_(folder.children).map(child => child.path + '/README.md');
	let header = folder.path == 'src' ? '' : `# ${folder.path}\r\n`;
	let promise = new Promise((resolve, reject) => {
		Promise.all(promises).then(() => {

			table = buildTable(folder);
			if (table) {
				table = '## contents: \r\n' + table + '\r\n-----\r\n\r\n';
			}
			gulp.src(readmes)
			.on('error', reject)
			.pipe(concat('README.md', { process: function(src, filePath){
				src = src.replace(/## contents:((.|\n|\r))+(?=-----)-----/gmi,'');
				return src;
			}}))
			.pipe(concat('README.md', { process: function(src, filePath){
				if (!folder.children.length || !folderName) {
					return table + src;
				} else {
					//let dirPath = toRelative(filePath, true);
					let header = '# ' + folderName + '\r\n';					
					return header + table + src;				
				}
			} }))
			//.pipe(concat.header(header))
			.pipe(gulp.dest(folder.path))
			.on('end', resolve);
		});
	});
	return promise;
}

gulp.task('docs:test', ['docs:_readme'], function(){
	let folder = takeFolder();
	let promise = buildFolderReadme(folder);
	return promise;
});

gulp.task('docs:clean', function(){
	return del(['README.md','src/**/README.md']);
});

gulp.task('docs:folders', ['docs:clean'], function(done) {
	let tasks = processFolder('src');	
	console.log('docs tasks: ', tasks.length);
	return merge(...tasks);
});
gulp.task('docs:_readme', ['docs:clean'], function(done) {
	let tasks = processFolder('src');	
	console.log('docs tasks: ', tasks.length);
	return merge(...tasks);
});

gulp.task('compile:docs',['docs:test'], () => {
	return gulp.src(['./header.md', 'src/README.md'])
		.pipe(concat('README.md'))	
		.pipe(gulp.dest('./'));
});

gulp.task('docs', ['compile:docs'])
