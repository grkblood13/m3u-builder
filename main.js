#!/usr/bin/env node

var spawn = require('child_process').spawn;
var args = process.argv.slice(2);
var cmd = ['--max-old-space-size=4096', __dirname+'/m3u-builder.js'].concat(args);

var main = spawn('node',cmd);

main.stdout.setEncoding('utf8');
main.stdout.on('data', function(data) {
	console.log(data.trim());
});

main.stderr.setEncoding('utf8');
main.stderr.on('data', function(data) {
	console.log(data.trim());
});
