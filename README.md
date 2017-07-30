# m3u-builder
Customize existing m3u lists and xmltv guides that can be used with IPTV Simple Client.

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

**REQUIRED:**
```
epgInput [OBJ] - URL to EPG source

  * host [STR]: 'HOST_URL'

  * port [STR]: 'HOST_PORT'

  * path [STR]: 'HOST_PATH'

  * auth (optional) [STR]: If password authentication is required for your epg then use this. example: 'username:password'

m3uInput [OBJ] - URL to M3U source

  * host [STR]: 'HOST_URL'

  * port [STR]: 'HOST_PORT'

  * path [STR]: 'HOST_PATH'

  * auth (optional) [STR]: If password authentication is required for your m3u file then use this. example: 'username:password'
```
**OPTIONAL:**
```
changeGroupTo [ARRAY] - Change group names. The array consists of array pairs of a current group name and what you want to replace it with. Empty group names are supported.

  `['','LOCAL']` - Make channels with no group name part of the LOCAL group.

includeUnmatched [OBJ] - channels and groups that don't have any EPG data that you would still like to include in the final EPG. This parameter is only used if withID is TRUE.

  * groups [ARR]: group names to include

  * channels [ARR]: channel names to include

omitMatched [OBJ] - channels and groups which should be omitted from EPG

  * groups [ARR]: group names to omit`

  * channels [ARR]: channel names to omit`

replaceInName [ARR] - Alter channel names. The array consists of array pairs of matches made by regular expressions and what to replace them with.

 `['\\\(.*\\\)','']` - Removes anything within () along with parenthesis themselves.

 `['US[/CA]*: ','']` - Removes 'US:' and 'US/CA: '.

replaceInUrl [ARR] - This option is used to change urls in the M3U file. The array consists of array pairs of matches made by regular expressions and what to replace them with.

 `['http://','http://user:pass@']` - Adds user authentication to streams. This is very useful with tvheadend.

withID [BOOL] - Only include channels with an ID set is set to TRUE. includeUnmatched takes precedence over this option.

  Default value: FALSE
```
#### params.cfg API

**REQUIRED:**
```
epgOutput [STR] - Path to output EPG file

m3uOutput [STR] - Path to output M3U file
```
**OPTIONAL:**
```
groupOrder [ARR] - order in which channel groups should be displayed on EPG. All remaining groups will be but in alphabetical order.
```
## Run Instructions

Assuming you've installed using NPM all that you need to run is launch either a command prompt (Windows) or terminal window (Linux) and run the following:

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
