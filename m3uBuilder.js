var fs = require('fs');
var http = require('http');
var xml2js = require('./node_modules/xml2js');
var wget = require('./node_modules/wget-improved');
var parser = new xml2js.Parser();
var builder = new xml2js.Builder();
var params = require('./params.cfg');

var epg = [];
var m3u = [];
var count = 0;

options = params.epg_input;
options.method = 'GET';
var epgString='';
var req = http.request(options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
                epgString+=chunk;
        });
        res.on('end', function() {
		count++;
		main();
        });
});
req.write('\n');

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
	var streams = [];
        m3ufile = fs.createWriteStream(params.output);
        m3u.forEach(function(val,idx) {
                var result = epg.filter(function(v) {
                    return v.id === val.id;
                })[0];

		// epg data available for channel
                if (typeof result != 'undefined') {
                        if (params.omitMatched.groups.indexOf(val.group) == -1 && params.omitMatched.channels.indexOf(val.name) == -1) {
                                params.replaceWith.forEach(function(pair) {
                                        val.name = changeName(val.name,pair[0],pair[1]);
                                })
                                streams.push({id:val.id,name:val.name,logo:val.logo,url:val.url,group:val.group});
                        }
		// epg data not available for channel
                } else {
                        if (params.includeUnmatched.groups.indexOf(val.group) > -1 || params.includeUnmatched.channels.indexOf(val.name) > -1) {
                                params.replaceWith.forEach(function(pair) {
                                        val.name = changeName(val.name,pair[0],pair[1]);
                                })
                                streams.push({id:val.id,name:val.name,logo:val.logo,url:val.url,group:val.group});
                        }
                }
        });
	return streams;
}

function buildM3u() {
	streams = pairStreams();
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

		// import epg data and remove anything channels or groups omitted
		parser.parseString(epgString, function (err, result) {
			result.tv.channel.forEach(function(channel,idx) {
				if (params.omitMatched.channels.indexOf(channel['display-name'][0]) > -1) {
					delete result.tv.channel[idx];
				}
				epg.push({id:channel.$.id,name:channel['display-name'][0]});
			});
			var xml = builder.buildObject(result);
        		epgFile = fs.createWriteStream(params.epg_output);
			epgFile.write(xml);
			epgFile.end();
			buildM3u();
		});
	}
}
