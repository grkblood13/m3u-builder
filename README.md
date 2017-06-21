# m3uBuilder
Customize existing m3u lists and xmltv guides that can be used with IPTV Simple Client.

m3uBuilder is a way to take an XMLTV file and m3u file and customize it to name the channels what you want them to be, order them how you want them displayed and remove channels that you don't want listed.

m3uBuilder requires Node.js and will run on either Windows or Linux. Other distros will probably work as well but haven't been tested.

By default m3uBuilder omits channels without valid EPG data. How, you can add these channels/groups back in params.js

## Linux Installation Instructions:

1) Install Node.js

   deb: `apt-get install nodejs`
   
   rpm: `yum install nodejs`
   
1) Download m3uBuilder-master.zip directory to /opt

   `cd /opt`

   `wget https://github.com/grkblood13/m3uBuilder/archive/master.zip`

2) Unzip and move m3uBuilder-master directory to /opt/m3uBuilder

   `unzip m3uBuilder-master.zip`

   `mv m3uBuilder-master m3uBuilder`

3) Edit m3uBuilder/params.js to have valid XMLTV and M3U file inputs.

4) Add the following to root's crontab:

   0 5 * * * node /opt/m3uBuilder/m3uBuilder.js
   
## Windows Installation Instructions:

1) Download and install Node.js

   https://nodejs.org/en/download/
   
2) Download m3uBuilder-master.zip

3) Extra file via 7zip by right clicking on the zipped file and going to 7-Zip > Extract Here

4) Rename m3uBuilder-master to m3uBuilder

5) Edit m3uBuilder/params.js to have valid XMLTV and M3U file inputs.

## Run Instructions:

   $ node /opt/m3uBuilder/m3uBuilder.js

   NOTE: For windows you will need to launch the nodejs command prompt
   
## Configuration Instructions:

m3uBuilder/params.js is where all configuration for m3uBuilder is done.

At a minimum you must have EPG and XMLTV sources. The following is a brief run down of your options.

epg_input [OBJ] - URL to EPG source

  * host [STR]: 'HOST_URL'

  * port [STR]: 'HOST_PORT'

  * path [STR]: 'HOST_PATH'

replaceWith [ARR] - pairs of matches made by regular expressions and what to replace them with. Each pair is it's own array.

 `['\\\(.*\\\)','']` - Removes anything within () along with parenthesis themselves.

 `['US[/CA]*: ','']` - Removes 'US:' and 'US/CA: '.

groupOrder [ARR] - order in which channel groups should be displayed on EPG. All remaining groups will be but in alphabetical order.

omitMatched [OBJ] - channels and groups which should be omitted from EPG

  * groups [ARR]: group names to omit`

  * channels [ARR]: channel names to omit`

includeUnmatched [OBJ] - channels and groups that don't have any EPG data that you would still like to include in the final EPG.

  * groups [ARR]: group names to include

  * channels [ARR]: channel names to include
