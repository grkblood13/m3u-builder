#!/usr/bin/env node

Array.prototype.clean = function(deleteValue) {
	for (var i = 0; i < this.length; i++) {
		if (this[i] == deleteValue) {         
			this.splice(i, 1);
			i--;
		}
	}
	return this;
};

var fs		= require('fs');
var resolve	= require('path').resolve;
var zlib	= require('zlib');
var argv	= require(__dirname+'/node_modules/minimist')(process.argv.slice(2));
var connect	= require(__dirname+'/node_modules/connect');
var http	= require(__dirname+'/node_modules/follow-redirects').http;
var merge	= require(__dirname+'/node_modules/merge');
var pd		= require(__dirname+'/node_modules/pretty-data').pd;
var serveStatic	= require(__dirname+'/node_modules/serve-static');
var xml2js	= require(__dirname+'/node_modules/xml2js');
var parser	= new xml2js.Parser();
var builder	= new xml2js.Builder();
var params;

function main() {
	var _itv=0;

	sourceCfg=__dirname+'/params.cfg';
	['c','cfg'].forEach(function(val) {
		if (argv.hasOwnProperty(val)) {
			if (typeof argv[val] == 'string') {
				try {
					_stat=fs.statSync(argv[val]);
					if (_stat.isFile()) sourceCfg=resolve(argv[val]);
				} catch(e) {};
			}
		}
	});
	params = require(sourceCfg);

	sourceDir=__dirname+'/sources';
	['d','dir'].forEach(function(val) {
		if (argv.hasOwnProperty(val)) {
			if (typeof argv[val] == 'string') {
				try {
					_stat=fs.statSync(argv[val]);
					if (_stat.isDirectory()) sourceDir=resolve(argv[val]);
				} catch(e) {};
			}
		}
	});

	if (argv.hasOwnProperty('groups')) {
		printGroups();
	} else if (argv.hasOwnProperty('help') || argv.hasOwnProperty('h')) {
		printHelp();
	} else if (argv.hasOwnProperty('info')) {
		printInfo();
	} else {
		if (argv.hasOwnProperty('port') || argv.hasOwnProperty('p')) {
			_port=80;
			if (argv.p >= 0) _port=argv.p;
			if (argv.port >= 0) _port=argv.port;

			_hostdir=params.m3uOutput.substring(0, Math.max(params.m3uOutput.lastIndexOf("/"), params.m3uOutput.lastIndexOf("\\")));
			connect().use(serveStatic(_hostdir)).listen(_port, function(){
				console.log('server mode: m3u-builder running on port '+_port);
			}).on('error', function(e) {
				console.log('server mode failed. reason: '+JSON.stringify(e));
				console.log('exiting now.');
				process.exit(1);
			});

		}
	
		if (argv.n >= 0) _interval=argv.n;
		if (argv.interval >= 0) _interval=argv.interval;
		if (typeof _interval == 'number') {
			if (_interval >= 5) {
				console.log('interval mode: m3u-builder running every '+_interval+' minutes');
				(function timer() {
					runBuilder(function() {
						if (++_itv==1) {
							if (typeof _port == 'number') {
								console.log('m3u file: http://localhost:'+_port+'/'+params.m3uOutput.replace(/^.*[\\\/]/, ''));
								console.log('xmltv file: http://localhost:'+_port+'/'+params.epgOutput.replace(/^.*[\\\/]/, ''));
							} else {
								console.log('m3u file: '+params.m3uOutput);
								console.log('xmltv file: '+params.epgOutput);
							}
						}
					});
				    setTimeout(timer, _interval*1000*60);
				})();
			} else {
				console.log('interval must be set to a minimum of 5 minutes. Exiting now.');
			}
		} else {
			runBuilder(function() {
				if (typeof _port == 'number') {
					console.log('m3u file: http://localhost:'+_port+'/'+params.m3uOutput.replace(/^.*[\\\/]/, ''));
					console.log('xmltv file: http://localhost:'+_port+'/'+params.epgOutput.replace(/^.*[\\\/]/, ''));
				} else {
					console.log('m3u file: '+params.m3uOutput);
					console.log('xmltv file: '+params.epgOutput);
				}
			});
		}
	}
}

// general functions
function checkNested(obj) {
	var args = Array.prototype.slice.call(arguments, 1);
	for (var i = 0; i < args.length; i++) {
		if (!obj || !obj.hasOwnProperty(args[i])) return false;
		obj = obj[args[i]];
	}
	return true;
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

function multiMatch(_arr,_val) {
	var _res = _arr.filter(function(res) {
		return _val.match(new RegExp(res,'i'));
	});
	return _res;
}

function replaceVal(name,match,replacement) {
	return name.replace(new RegExp(match,'i'),replacement);
}

// application functions
function buildM3uFile(streams, callback) {
	sortedStreams = [];

	// sort group ordered streams
	params.groupOrder.forEach(function(group) {
		streamGroup = [];
		streams.forEach(function(ob) {
	        	if (ob.group === group)  {
	                	streamGroup.push(ob);
	        	}
		});
		sortedStreams = sortedStreams.concat(streamGroup.sort(compareNames));				
	});

	// remove group ordered streams from stream list then sort remaining groups
	streams = streams.filter(function(ob) {
		return params.groupOrder.indexOf(ob.group) < 0;
	});
	streams = sortedStreams.concat(sortGroupsThenNames(streams));

	// setPosition
	if (params.setPosition.constructor === Array) {
		// [name,position,group]
		positions = params.setPosition.filter(function(res) {
			return res.length == 3;
		});

		positions.forEach(function(val) {
			idx = streams.findIndex(function(elm) { return elm.orig === val[0]; })
			if (idx > -1) {
				moveEntry = streams.splice(idx,1);
				idx = streams.findIndex(function(elm) { return elm.group === val[2]; })
				if (idx > -1) {
					idx = idx+val[1]-1;
					streams.splice(idx,0,moveEntry[0]);
				}
			}
		});

		// [name,position]
		positions = params.setPosition.filter(function(res) {
			return res.length == 2 && parseInt(res[1],10);
		});

		positions.forEach(function(val) {
			idx = streams.findIndex(function(elm) { return elm.orig === val[0]; })
			if (idx > -1) {
				moveEntry = streams.splice(idx,1);
				streams.splice(val[1]-1,0,moveEntry[0]);
			}
		});
	}

	// write new m3u file
	m3ufile = fs.createWriteStream(params.m3uOutput);
	m3ufile.once('open', function(fd) {
		m3ufile.write("#EXTM3U\n");
		streams.forEach(function(val,idx) {
			(params.allCaps == true) ? _name = val.name.toUpperCase() : _name = val.name;
                        m3ufile.write('#EXTINF:-1, tvg-id="'+val.id+'" tvg-name="'+_name+'" tvg-logo="'+val.logo+'" group-title="'+val.group+'", '+_name+'\n');
			m3ufile.write(val.url+'\n');
		})
		m3ufile.end();
		fs.chmodSync(params.m3uOutput, 0777);
		fs.chmodSync(params.epgOutput, 0777);
		return callback();
	});	
}

function buildStreams(sourceId,sourceStreams,_params) {
	_streams = [];
	sourceStreams.forEach(function(val,idx) {
		var _remove=0;
		if (val.id.length == 0 && _params.withID == true) {
			// remove streams with no ID, unless included in 'includeUnmatched'
			if (!(_params.includeUnmatched.groups.indexOf(val.group) > -1 || _params.includeUnmatched.channels.indexOf(val.name) > -1)) _remove=1;
		}

		if (_remove==0) {
			// change group
 			for (var key in _params.changeGroupOfChannel) {
				var _regs = _params.changeGroupOfChannel[key];
				for (var i=0; i < _regs.length; i++) {
					if (val.name.match(new RegExp(_regs[i],'i'))) {
						val.group = key;
						break;
					}
				}
			}

			// rename group
 			var index = _params.renameGroup.map(function(x) { return x[0] }).indexOf(val.group);
			if (index > -1) val.group = _params.renameGroup[index][1];

			// only keep wanted channels/groups
			if (multiMatch(_params.omitMatched.groups,val.group) == 0 && multiMatch(_params.omitMatched.channels,val.name) == 0) {

				// change channel name
				if (_params.replaceInName.length > 0) {
					_params.replaceInName.forEach(function(pair) { val.name = replaceVal(val.name,pair[0],pair[1]).trim(); })
				}

				// change url string
				if (_params.replaceInUrl.length > 0) {
					_params.replaceInUrl.forEach(function(pair) { val.url = replaceVal(val.url,pair[0],pair[1]).trim(); })
				}

				// add unique identifier to id
				(val.id.length > 0) ? _id=sourceId+'-'+val.id : _id='';
				
				_streams.push({'id':_id,'orig':val.orig,'name':val.name,'logo':val.logo,'url':val.url,'group':val.group});
			}
		}
	});
	return _streams;
}

function compareNames(a,b) {
	var alist = a.name.split(/(\d+)/),
	blist = b.name.split(/(\d+)/);

	alist.slice(-1) == '' ? alist.pop() : null;
	blist.slice(-1) == '' ? blist.pop() : null;

	for (var i = 0, len = alist.length; i < len;i++){
		if (alist[i] != blist[i]){
			if (alist[i].match(/\d/)) {
				return +alist[i] - +blist[i];
			} else {
				return alist[i].localeCompare(blist[i]);
			}
		}
	}   
	return true;
}

function download(idx, url, callback) {
	var buffer = [];
	http.get(url, function(res) {
  		var contentType = res.headers['content-type'];

		if (contentType == 'application/x-gzip') {
			var gunzip = zlib.createGunzip();            
			res.pipe(gunzip);

			gunzip.on('data', function(data) {
				buffer.push(data.toString())

			}).on("end", function() {
				return callback({index: idx, result: buffer.join("")}); 

			}).on("error", function(e) {
				return callback({error: JSON.stringify(e)});
			});
		} else {
			res.on('data', function(data) {
				buffer.push(data.toString())

			}).on("end", function() {
				return callback({index: idx, result: buffer.join("")}); 

			}).on("error", function(e) {
				return callback({error: JSON.stringify(e)});
			});
		}
	}).on('error', function(e) {
		return callback({error: JSON.stringify(e)});
	});
}

function fetchSources(req, callback) {
	var _count=0;
	var _numSources=0;
	var _sources=[];
	fs.readdirSync(req).forEach(function(file,idx) {
		if (file.substr(0,1) != '.') {
			_id=file.substr(0,file.lastIndexOf('.'));
			_sources[idx] = {
				id: _id,
				params: {
					epgInput: { host:'', port:'', path:'', auth:'', file:'' },
					m3uInput: { host:'', port:'', path:'', auth:'', file:'' },
					addAuthToStreams: '',
					changeGroupOfChannel: {},
					replaceInName: [],
					replaceInUrl: [],
					renameGroup: [],
					omitMatched: { groups: [], channels: [] },
					includeUnmatched: { groups: [], channels: [] },
					withID: false
				},
				epg: '',
				streams: []
			}
			_sources[idx].params = merge.recursive(true,_sources[idx].params,require(req+'/'+file));
			_numSources+=2;
		}
	})

	_sources.forEach(function(sourceObj,idx) {
		_sources[idx].epg = '';
		_sources[idx].streams = [];

		if (sourceObj.params.epgInput.file.length > 0) {
			var _out = sourceObj.params.epgInput.file;			
			if (_out.indexOf('.gz') > 0) {
				unzipFile(idx, _out, function(res) {
					//_sources[res.index].epg=res.result;
					_sources[res.index].epg=pd.xml(res.result);
					_count++;
					if (_count==_numSources) return callback(_sources);
				});
			} else {
				_sources[idx].epg=pd.xml(fs.readFileSync(_out, {encoding:'utf8'}));
				_count++;
				if (_count==_numSources) return callback(_sources);
			}			
		} else {
    			download(idx, sourceObj.params.epgInput, function(res) {
				(res.error) ? console.error(res.error) : _sources[res.index].epg=pd.xml(res.result);
				_count++;
				if (_count==_numSources) return callback(_sources);
			});
		}

		if (sourceObj.params.m3uInput.file.length > 0) {
			_sources[idx].streams=parseM3U(fs.readFileSync(sourceObj.params.m3uInput.file, {encoding:'utf8'}));
			_count++;
			if (_count==_numSources) return callback(_sources);
		} else {
    			download(idx, sourceObj.params.m3uInput, function(res) {
				(res.error) ? console.error(res.error) : _sources[res.index].streams=parseM3U(res.result);
				_count++;
				if (_count==_numSources) return callback(_sources);
			});
		}
	});
}

function getGroups(arr) {
	var _groups = [];
	arr.forEach(function(val) {
		if (_groups.indexOf(val.group) == -1) { _groups.push(val.group); }
	});
	return _groups;
}

function parseM3U(req) {
	var _streams = [];
	var array = req.split(/[\n\r]+/);
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
		                if (url.length > 0) _streams.push({id:id,orig:name,name:name,logo:logo,url:url,group:group})
				break;
		}
	}
	return _streams;
}

function printGroups() {
	fetchSources(sourceDir, function(_sources) {
		if (_sources.hasOwnProperty('error')) {
			console.log(_sources.error);
			return;
		}
		if (argv.groups.length > 0) {
			index = _sources.map(function (_ob) { return _ob.id }).indexOf(argv.groups);
			if (index > -1) {
				_groups=getGroups(_sources[index].streams).sort();
				_groups.forEach(function(val) { console.log(val); });
			}
		} else {
			console.log('source not specified.');
		}
	})
}

function printHelp() {
	console.log('M3U-BUILDER MANPAGE');
	console.log('\r');
	console.log('NAME');
	console.log('\tm3u-builder');
	console.log('\r');
	console.log('SYNOPSIS');
	console.log('\tm3u-builder [ options ]');
	console.log('\r');
	console.log('DESCRIPTION');
	console.log('\tm3u-builder is a tool that takes existing m3u playlists with associated xmltv epg files and edits them to fit your exact needs.');
	console.log('\r');
	console.log('OPTIONS');
	console.log('\t-c, --cfg CFG_FILE');
	console.log('\t\tParams config file. Default: ~/params.cfg');
	console.log('\r');
	console.log('\t-d, --dir SOURCE_DIR');
	console.log('\t\tDirectory containing source config files. Default: ~/sources');
	console.log('\r');
	console.log('\t--groups SOURCE');
	console.log('\t\tLists all groups in alphabetical order supplied from SOURCE.cfg file.');
	console.log('\r');
	console.log('\t--info SOURCE');
	console.log('\t\tLists all information of channels supplied from SOURCE.cfg file.');
	console.log('\r');
	console.log('\t-n, --interval MINUTES');
	console.log('\t\tRun m3u-builder every N minutes. Must be set to atleast 5 minutes.');
	console.log('\r');
	console.log('\t-o, --output ELM1,ELM2,...');
	console.log('\t\tFormat output of --info.');
	console.log('\t\tPossible values: \'id\', \'name\', \'logo\', \'url\', \'group\'');
	console.log('\r');
	console.log('\t-p, --port PORT');
	console.log('\t\tHost files at a specific port to use network links instead of static file paths.');
	console.log('\r');
	console.log('\t--sort-by STRING');
	console.log('\t\tSort info output by parameter.');
	console.log('\t\tPossible values: \'id\', \'name\', \'logo\', \'url\', \'group\'');
	console.log('\t\tDefault value: \'name\'');
	console.log('\r');
	console.log('\t--with-id');
	console.log('\t\tMakes info output only display channels with an ID set, which means only channels with EPG data.');
}

function printInfo() {
	var _objElms = ['id','name','logo','url','group'];
	fetchSources(sourceDir, function(_sources) {
		if (_sources.hasOwnProperty('error')) {
			console.log(_sources.error);
			return;
		}
		if (argv.info.length > 0) {

			(typeof argv.output == 'string') ? _out=argv.output.split(',') : _out=_objElms;
			(typeof argv.o == 'string') ? _out=argv.o.split(',') : _out=_objElms;

		        index = _sources.map(function (_ob) { return _ob.id }).indexOf(argv.info);
		        if (index > -1) {
				(_objElms.indexOf(argv['sort-by']) > -1) ? _sort=argv['sort-by'] : _sort='name';
		                _sources[index].streams.sort(dynamicSort(_sort)).forEach(function(ob) {
					if (argv['with-id'] == true && ob.id.length == 0) return;
					for (var key in ob) {		
		                        	if (ob[key].length == 0 || _out.indexOf(key) == -1) delete ob[key]
					}			
		                        console.log(JSON.stringify(ob));
		                });
		        }
		} else {
			console.log('source not specified.');
		}
	});
}

function runBuilder(callback) {
	var _epgObj = {
		tv: { 
			'$': {
				'generator-info-name':	'M3UBUILDER',
				'generator-info-url':	'http://www.github.com/grkblood13/m3u-builder'
			},
	     		channel: [],
			programme: []
		}
	}

	fetchSources(sourceDir, function(_sources) {
		if (_sources.hasOwnProperty('error')) {
			console.log(_sources.error);
			return;
		}
		var _streams = [];
		_sources.forEach(function(sourceObj) {

			_streams = _streams.concat(buildStreams(sourceObj.id,sourceObj.streams,sourceObj.params));

			sourceObj.epg=sourceObj.epg.split(/[\r\n]+/).clean('');

			if (sourceObj.epg.length <= 2) {
				console.log('invalid xmltv file. skipping '+sourceObj.id+' entry.');
				return;
			}

			if (sourceObj.epg[1].substr(0,3) == "<tv") {
				sourceObj.epg.splice(1, 0, "<!DOCTYPE tv SYSTEM \"xmltv.dtd\">");
			}

			sourceObj.epg[2] = sourceObj.epg[2].replace(/<tv/,'<tv generator-info-id="'+sourceObj.id+'"');
			sourceObj.epg = sourceObj.epg.join('\n');

			parser.parseString(sourceObj.epg, function (err, result) {
				if (err != null || checkNested(result,'tv','$','generator-info-id') == false) {
					console.log('invalid xmltv file. skipping '+sourceObj.id+' entry.');
					return;
				}

				key=result.tv.$['generator-info-id'];
				result.tv.channel.forEach(function(channel,idx) {
					// prepend identifier to channel data
					if (channel.$.id.length > 0) result.tv.channel[idx].$.id=key+'-'+channel.$.id;

					var _res = _streams.filter(function(res) {
						return res.id === channel.$.id;
					})[0];

					if (typeof _res != 'undefined') _epgObj.tv.channel.push(result.tv.channel[idx]);
				});

				result.tv.programme.forEach(function(programme,idx) {
					// prepend identifier to program data
					if (programme.$.channel.length > 0) result.tv.programme[idx].$.channel=key+'-'+programme.$.channel;

					var _res = _streams.filter(function(res) {
						return res.id === programme.$.channel;
					})[0];

					if (typeof _res != 'undefined') _epgObj.tv.programme.push(result.tv.programme[idx]);
				});
			});
		});

		// write guide data to file
		var xml = builder.buildObject(_epgObj);
		epgFile = fs.createWriteStream(params.epgOutput);
		epgFile.write(xml);
		epgFile.end();

		buildM3uFile(_streams, function() {
			//console.log('m3u-builder has successfully completed!');
			return callback();
		});
	});
}

function sortGroupsThenNames(arr) {
	var _groups=getGroups(arr).sort();
	var _output = [];
	_groups.forEach(function(val) {
		_match=arr.filter(function(ob) { return ob.group == val; });
		_match.sort(compareNames);
		_output = _output.concat(_match);
	});
	return _output;
}

function unzipFile(_idx,_file,_cb) {				
	zlib.unzip(fs.readFileSync(_file), function(err,res) {
		return _cb({index:_idx,result:res.toString()});
	});
}

main();
