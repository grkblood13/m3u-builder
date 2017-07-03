var fs = require('fs');
var http = require('http');
var argv = require(__dirname+'/node_modules/minimist')(process.argv.slice(2));
var merge = require(__dirname+'/node_modules/merge');
var xml2js = require(__dirname+'/node_modules/xml2js');
var parser = new xml2js.Parser();
var builder = new xml2js.Builder();
var params = require(__dirname+'/params.cfg');

var m3u = [];
var streams = [];
var count = 0;
var numSources = 0;
var sources = []; 
var epgObj = {
	tv: { 
		'$': {
			'generator-info-name':	'M3UBUILDER',
			'generator-info-url':	'http://www.github.com/grkblood13/m3uBuilder'
		},
     		channel: [],
		programme: []
	}
}
		

fs.readdirSync(__dirname+'/sources').forEach(function(file,idx) {
	_id=file.substr(0,file.lastIndexOf('.'));
	sources[idx] = {
		id: _id,
		params: {
			epg_input: { host:'', port:'', path:'', auth:'' },
			m3u_input: { host:'', port:'', path:'', auth:'' },
			addAuthToStreams: '',
			replaceInName: [],
			replaceInUrl: [],
			changeGroupTo: [],
			omitMatched: { groups: [], channels: [] },
			includeUnmatched: { groups: [], channels: [] }
		},
		epg: '',
		streams: []
	}
	sources[idx].params = merge.recursive(true,sources[idx].params,require(__dirname+'/sources/'+file));
	numSources+=2;
})

sources.forEach(function(sourceObj) {

	var downloadEPG = http.request(sourceObj.params.epg_input, function(res) {
		_host=this._header.match(/Host\:(.*)/i)[1].trim().split(':');
		index = sources.map(function (_ob) { return (_ob.params.epg_input.host===_host[0] && _ob.params.epg_input.port===parseInt(_host[1])); }).indexOf(true);

		res.setEncoding('utf8');
		res.on('data', function (chunk) {
		        sources[index].epg+=chunk;
		});
		res.on('end', function() {
			count++;
			main();
		});
	});
	downloadEPG.end();

	var downloadM3U = http.request(sourceObj.params.m3u_input, function(res) {
		_host = this._header.match(/Host\:(.*)/i)[1].trim().split(':');
		index = sources.map(function (_ob) { return (_ob.params.m3u_input.host===_host[0] && _ob.params.m3u_input.port===parseInt(_host[1])); }).indexOf(true);

		var m3uString = '';
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
		        m3uString+=chunk;
		});
		res.on('end', function() {
			var array = m3uString.split(/[\n\r]+/);
			array.shift();
			for (var i=0; i < array.length; i++) {
				_line=array[i].replace(/[\n\r\t]/g,"");
				switch (i % 2) {
					case 0:
						id=_line.match(/tvg-id\="(.*?)"/i);
						(id == null) ? id='' : id=id[1];
						name=_line.match(/tvg-name\="(.*?)"/i);
						(name == null) ? name=_line.substr(_line.lastIndexOf(',')+1) : name=name[1];
						logo=_line.match(/tvg-logo\="(.*?)"/i);
						(logo == null) ? logo='' : logo=logo[1];
						group=_line.match(/group-title\="(.*?)"/i);
						(group == null) ? group='' : group=group[1];
						break;
					case 1:
						url=_line;
		                                if (url.length > 0) sources[index].streams.push({id:id,name:name,logo:logo,url:url,group:group})
						break;
				}
			}
			count++;
			main();
		});
	});
	downloadM3U.end();
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

function buildStreams(sourceId,sourceStreams,_params) {

	_streams = [];
        sourceStreams.forEach(function(val,idx) {

		_remove=0;
		// remove streams that have no guide data (really just checking 'id'), unless included in 'includeUnmatched'
		if (val.id.length == 0) {
			if (!(_params.includeUnmatched.groups.indexOf(val.group) > -1 || _params.includeUnmatched.channels.indexOf(val.name) > -1)) _remove=1;
		}

		if (_remove==0) {
			// change group name
			//if (_params.changeGroupTo.hasOwnProperty(val.group)) val.group = _params.changeGroupTo[val.group];
 			index = _params.changeGroupTo.map(function(x) { return x[0] }).indexOf(val.group);
			if (index > -1) val.group = _params.changeGroupTo[index][1];
			// only keep wanted channels/groups
		        if (!(_params.omitMatched.groups.indexOf(val.group) > -1 || _params.omitMatched.channels.indexOf(val.name) > -1)) {

				// change channel name
				_params.replaceInName.forEach(function(pair) { val.name = changeName(val.name,pair[0],pair[1]).trim(); })

				// add unique identifier to id
				if (val.id.length > 0) { _id=sourceId+'-'+val.id  } else { _id=''; }

				// change url string
				_params.replaceInUrl.forEach(function(pair) { val.url = changeName(val.url,pair[0],pair[1]).trim(); })

				_streams.push({'id':_id,'name':val.name,'logo':val.logo,'url':val.url,'group':val.group});
			}
		}
	});

	return _streams;
}

function buildM3uFile(callback) {
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
        m3ufile = fs.createWriteStream(params.m3u_output);
	m3ufile.once('open', function(fd) {
		m3ufile.write("#EXTM3U\n");
		streams.forEach(function(val,idx) {
                        m3ufile.write('#EXTINF:-1, tvg-id="'+val.id+'" tvg-name="'+val.name+'" tvg-logo="'+val.logo+'" group-title="'+val.group+'", '+val.name+'\n');
			m3ufile.write(val.url+'\n');
		})
		m3ufile.end();
		fs.chmodSync(params.m3u_output, 0777);
		fs.chmodSync(params.epg_output, 0777);
		return callback();
	});	
}

function main() {
	if (count==numSources) {
                // print channels (CLI option)
                if (argv.hasOwnProperty('channels')) {
                        if (argv.channels.length > 0) {
                                index = sources.map(function (_ob) { return _ob.id }).indexOf(argv.channels);
                                if (index > -1) {
                                        sources[index].streams.sort(dynamicSort("name")).forEach(function(ob) {
                                                console.log(ob.name);
                                        });
                                }
                        }

                // print groups (CLI option)
                } else if (argv.hasOwnProperty('groups')) {
                        if (argv.groups.length > 0) {
                                index = sources.map(function (_ob) { return _ob.id }).indexOf(argv.groups);
                                if (index > -1) {
                                        groups = [];
                                        sources[index].streams.sort(dynamicSort("group")).forEach(function(ob) {
                                                if (groups.indexOf(ob.group) < 0) { groups.push(ob.group); }
                                        });
                                        groups.forEach(function(val) { console.log(val); });
                                }
                        }

		// build files (core capability)
		} else {
			//for (var key in sources) {
			sources.forEach(function(sourceObj) {

				streams = streams.concat(buildStreams(sourceObj.id,sourceObj.streams,sourceObj.params));

				// import epg data
				sourceObj.epg=sourceObj.epg.replace(/<tv /,'<tv generator-info-id="'+sourceObj.id+'" ');

				parser.parseString(sourceObj.epg, function (err, result) {
					key=result.tv.$['generator-info-id'];
					result.tv.channel.forEach(function(channel,idx) {
						// prepend identifier to channel data
						if (channel.$.id.length > 0) result.tv.channel[idx].$.id=key+'-'+channel.$.id;

						var _res = streams.filter(function(res) {
							return res.id === channel.$.id;
						})[0];

						if (typeof _res != 'undefined') epgObj.tv.channel.push(result.tv.channel[idx]);
					});

					result.tv.programme.forEach(function(programme,idx) {
						// prepend identifier to program data
						if (programme.$.channel.length > 0) result.tv.programme[idx].$.channel=key+'-'+programme.$.channel;

						var _res = streams.filter(function(res) {
							return res.id === programme.$.channel;
						})[0];

						if (typeof _res != 'undefined') epgObj.tv.programme.push(result.tv.programme[idx]);
					});
				});
			});

			// write guide data to file
			var xml = builder.buildObject(epgObj);
			epgFile = fs.createWriteStream(params.epg_output);
			epgFile.write(xml);
			epgFile.end();

			buildM3uFile(function() {
				console.log('m3uBuilder has successfully completed!');
				console.log('M3U file: '+params.m3u_output);
				console.log('XMLTV file: '+params.epg_output);
			});
		}
	}
}
