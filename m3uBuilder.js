var fs = require('fs');
var http = require('http');
var argv = require('./node_modules/minimist')(process.argv.slice(2));
var xml2js = require('./node_modules/xml2js');
var wget = require('./node_modules/wget-improved');
var parser = new xml2js.Parser();
var builder = new xml2js.Builder();
var params = require('./params.cfg');

var m3u = [];
var streams = [];
var count = 0;
var epgString = '';

options = params.epg_input;
options.method = 'GET';

var downloadEPG = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
                epgString+=chunk;
        });
        res.on('end', function() {
		count++;
		main();
        });
});
downloadEPG.end();

var downloadM3U = wget.download(params.m3u_input, params.m3u_output);
downloadM3U.on('end', function() {
	count++
	main();
});

function changeName(name,match,replacement) {
        return name.replace(new RegExp(match,'i'),replacement);
}

function dynamicSort(property) {
    var sortOrder = 1;
    if(property[0] === "-") {
        sortOrder = -1;
        property = property.substr(1);
    }
    return function (a,b) {
        var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
        return result * sortOrder;
    }
}

function dynamicSortMultiple() {
    var props = arguments;
    return function (obj1, obj2) {
        var i = 0, result = 0, numberOfProperties = props.length;
        while(result === 0 && i < numberOfProperties) {
            result = dynamicSort(props[i])(obj1, obj2);
            i++;
        }
        return result;
    }
}

function pairStreams() {
	_streams = [];
        m3u.forEach(function(val,idx) {
		// change group name
		if (params.changeGroupTo.hasOwnProperty(val.group)) val.group = params.changeGroupTo[val.group];

		// only keep wanted channels/groups
                if (!(params.omitMatched.groups.indexOf(val.group) > -1 || params.omitMatched.channels.indexOf(val.name) > -1)) {

			// change channel name
			params.replaceWith.forEach(function(pair) { val.name = changeName(val.name,pair[0],pair[1]); })
			_streams.push({id:val.id,name:val.name,logo:val.logo,url:val.url,group:val.group});
		}
	});
	return _streams;
}

function buildM3uFile() {
	sortedStreams = [];

	// sort group ordered streams
	params.groupOrder.forEach(function(group) {
		streamGroup = [];
		streams.forEach(function(ob) {
	        	if (ob.group === group)  {
	                	streamGroup.push(ob);
	        	}
		});
		sortedStreams = sortedStreams.concat(streamGroup.sort(dynamicSort("name")));				
	});

	// remove group ordered streams from stream list then sort remaining groups
	streams = streams.filter(function(ob) {
		return params.groupOrder.indexOf(ob.group) < 0;
	});
	streams = sortedStreams.concat(streams.sort(dynamicSortMultiple("group", "name")));

	// write new m3u file
        m3ufile = fs.createWriteStream(params.output);
	m3ufile.once('open', function(fd) {
		m3ufile.write("#EXTM3U\n");
		streams.forEach(function(val,idx) {
                        m3ufile.write('#EXTINF:-1, tvg-id="'+val.id+'" tvg-name="'+val.name+'" tvg-logo="'+val.logo+'" group-title="'+val.group+'", '+val.name+'\n');
			m3ufile.write(val.url+'\n');
		})
		m3ufile.end();
		fs.chmodSync(params.m3u_output, 0777);
		fs.chmodSync(params.epg_output, 0777);
	});	
}

function main() {
	if (count==2) {
		// import m3u data
		var array = fs.readFileSync(params.m3u_output).toString().split("\n");
		array.shift();
		for (var i=0; i < array.length; i++) {
			_line=array[i].replace(/[\n\r\t]/g,"");
			switch (i % 2) {
				case 0:
					id=_line.match(/tvg-id\="(.*?)"/i)[1];
					name=_line.match(/tvg-name\="(.*?)"/i)[1];
					logo=_line.match(/tvg-logo\="(.*?)"/i)[1];
					group=_line.match(/group-title\="(.*?)"/i)[1];
					break;
				case 1:
					url=_line;
                                        m3u.push({id:id,name:name,logo:logo,url:url,group:group})
					break;
			}
		}

		// print channels (CLI option)
		if (argv.hasOwnProperty('channels')) {
			m3u.sort(dynamicSort("name")).forEach(function(ob) {
				console.log(ob.name);
			});

		// print groups (CLI option)
		} else if (argv.hasOwnProperty('groups')) {
			var groups = [];
			m3u.sort(dynamicSort("group")).forEach(function(ob) {
				if (groups.indexOf(ob.group) < 0) { groups.push(ob.group); }
			});
			groups.forEach(function(val) { console.log(val); });

		// build files (core capability)
		} else {
			streams = pairStreams();

			// import epg data
			parser.parseString(epgString, function (err, result) {

				// clean up channel guide data
				result.tv.channel.forEach(function(channel,idx) {
					var _res = streams.filter(function(res) {
						return res.id === channel.$.id;
					})[0];

					// no stream with channel id in final list
					if (typeof _res == 'undefined') delete result.tv.channel[idx];
				});

				// clean up program guide data
				result.tv.programme.forEach(function(programme,idx) {
					var _res = streams.filter(function(res) {
						return res.id === programme.$.channel;
					})[0];

					// no stream with channel id in final list
					if (typeof _res == 'undefined') delete result.tv.programme[idx];
				});

				// write guide data to file
				var xml = builder.buildObject(result);
				epgFile = fs.createWriteStream(params.epg_output);
				epgFile.write(xml);
				epgFile.end();

				// remove streams that have no guide data, unless included in 'includeUnmatched'
				for (var i=streams.length-1; i >= 0; i-=1) {					
					if (!(streams[i].id)) {
						if (!(params.includeUnmatched.groups.indexOf(streams[i].group) > -1 || params.includeUnmatched.channels.indexOf(streams[i].name) > -1)) {
							streams.splice(i,1);
						}
					}
				}
				buildM3uFile();
			});
		}
	}
}
