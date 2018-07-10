# m3u-builder
Customize existing m3u lists and xmltv guides that can be used with IPTV Simple Client or any programming guide that uses m3u and xmltv files.

m3u-builder is a way to take an XMLTV file and m3u file and customize it to name the channels what you want them to be, order them how you want them displayed and remove channels that you don't want listed.

m3u-builder requires Node.js and will run on either Windows or Linux.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine. 

### Prerequisites

Node.js is the only requirement to run m3u-builder. The following instructions are OS specific ways to install Node.js.

Windows:

[Download](https://nodejs.org/en/download/) from official Node.js site and run the Windows installer.

Debian-based Linux:

Launch a terminal window and run `apt-get install nodejs`

YUM-based Linux:

Launch a terminal window and run `yum install nodejs`

### Installing

Windows:

Launch the Node.js command prompt and run `npm install m3u-builder -g`

Linux:

Launch a terminal window and run `sudo npm install m3u-builder -g`

### Configuring

At a minimum you must have one EPG and XMLTV source. Each source should have it's own FILE.cfg in the sources directory.

All customization of channels and groups are done in these files.

#### sources/SOURCE.cfg API

**REQUIRED FIELDS:**
```
epgInput [OBJ] - EPG source. Input can be either a URL or file.

  * file [STR]: '/FULL/PATH/TO/FILE.xml'

  * url [STR]: 'http://HOST_URL/xmltv.php'

m3uInput [OBJ] - M3U source. Input can be either a URL or file.

  * file [STR]: '/FULL/PATH/TO/FILE.xml'

  * url [STR]: 'http://HOST_URL/playlist/channels.m3u?profile=pass'
```
**OPTIONAL FIELDS:**
```
changeGroupOfChannel [OBJ] -  Change group of channel based on regular expressions. First field of array is the regular expression for the channel name and the second field is the group to change to.

  * syntax: changeGroupOfChannel = { 'GROUP_NAME_1': ['CHAN_1','CHAN_2'], 'GROUP_NAME_2': ['CHAN_3'], ... }

  example: `{'KIDS': ['NICK','TOON','DISNEY']}` - Make any channels with NICK, TOON or DISNEY in their name a member of the KIDS group.

includeUnmatched [OBJ] - Channels and groups that don't have any EPG data that you would still like to include in the final EPG. This parameter is only used if withID is TRUE.

  * groups [ARR]: group names to include

  * channels [ARR]: channel names to include

omitMatched [OBJ] - channels and groups which should be omitted from EPG. Entries will be interpretted as regex strings.

  * groups [ARR]: group names to omit

  * channels [ARR]: channel names to omit

renameGroup [MARR] - Renames groups. The array consists of array pairs of a current group name and what you want to replace it with. Empty group names are supported.

  example: `['','LOCAL']` - Make channels with no group name part of the LOCAL group.
  
replaceInName [MARR] - Alter channel names. The array consists of array pairs of matches made by regular expressions and what to replace them with.

  example 1: `['\\\(.*\\\)','']` - Removes anything within () along with parenthesis themselves.

  example 2: `['US[/CA]*: ','']` - Removes 'US:' and 'US/CA: '.

replaceInUrl [MARR] - This option is used to change urls in the M3U file. The array consists of array pairs of matches made by regular expressions and what to replace them with.

  example: `['http://','http://user:pass@']` - Adds user authentication to streams. This is very useful with tvheadend.

setChanNum [MARR] - Set EXTINF channel number. The array consists of array pairs. Each pair should have the original channel name and the channel number.

  example: [['CHANNEL_1',1],['CHANNEL_2',2]]

withID [BOOL] - Only include channels with an ID set is set to TRUE. includeUnmatched takes precedence over this option. Default value: FALSE
```
#### params.cfg API

**REQUIRED:**
```
epgOutput [STR] - Path to output EPG file

m3uOutput [STR] - Path to output M3U file
```
**OPTIONAL:**
```
allCaps [BOOL] - Make channel names all uppercase. Default value: FALSE

groupOrder [ARR] - Order in which channel groups should be displayed on EPG. All remaining groups will be but in alphabetical order.

	* syntax: [ 'CHANNEL_A', 'CHANNEL_B', ... ]
	
removeWhitespace [BOOL] - Removes all white space from channel names. Default value: FALSE

setPosition [MARR] - Position channel(s) relatively based off of placement within group or absolutely based on overall number.

	Arrays consist of two required fields (channel name and position) and a third optional field to specify a group.

	If there is no group specified in the third field the channel will be placed at whatever position specified from the beginning of the channel list.

	If there is a channel group specified then the channel will be placed at the specified position with that group of channels.

	* syntax: [ ['CHANNEL_A',1,'LOCAL'], ['CHANNEL_B',1,'LOCAL'], ... ]

	example 1: `['CHANNEL_N',1]` - Make CHANNEL_N the very first channel listed in your guide.

	example 2: `['CHANNEL_N',1,'LOCAL']` - Make CHANNEL_N the first channel listed within the LOCAL group.
```
## Run Instructions

Assuming you've installed m3u-builder using NPM, all that you need to do is launch either a command prompt (Windows) or terminal window (Linux) and run the following:

`m3u-builder`

## Command Line Options
```
-c, --cfg CFG_FILE: Params config file. Default: ~/params.cfg

-d, --dir SOURCE_DIR: Directory containing source config files. Default: ~/sources

--groups SOURCE: Lists all groups in alphabetical order supplied from SOURCE.cfg file.

--info SOURCE: Lists all information of channels supplied from SOURCE.cfg file.

-h, --help: print help menu.

-n, --interval MINUTES: run m3u-builder every N minutes. Must be set to atleast 5 minutes.

-o, --output ELM1,ELM2,...: Format output of info.

  Possible values: 'id', 'name', 'logo', 'url', 'group'

-p, --port PORT: Host files at a specific port to use network links instead of static file paths.

--sort-by STRING: Sort output by parameter. Default: 'name'

  Possible values: 'id', 'name', 'logo', 'url', 'group'

--with-id: Makes --info output only display channels with an ID set, which means only channels with EPG data.
```
