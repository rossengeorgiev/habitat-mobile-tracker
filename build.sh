#!/bin/bash

# compile stylesheet
echo -n "Compiling CSS... "
cd css
rm -f mobile.css
cat base.css skeleton.css layout.css habitat-font.css main.css > mobile.tmp
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=css mobile.tmp > mobile.css
rm -f mobile.tmp
cd ..
echo "Done!"

#compile javascript
echo -n "Compiling JavaScript... "
cd js
rm -f mobile.js init_plot.js
# precompiled libs
cat jquery* iscroll.js >> mobile.js

VERSION="`git rev-parse --short HEAD`"

# compile the rest
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge gmaps_extentions.js >> mobile.js
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge chasecar.lib.js | sed "s/{VER}/$VERSION/" >> mobile.js
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge nite-overlay.js >> mobile.js
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge tracker.js >> mobile.js
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge app.js >> mobile.js

#compile plot lib and config
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge _jquery.flot.js >> init_plot.js
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge plot_config.js >> init_plot.js

cd ..
echo "Done!"
echo -n "Generate cache.manifest..."


sed "s/^\(# version\) .*$/\1 $VERSION `date +%s`/" cache.manifest-dev > cache.manifest

echo "Done!"

echo "Build version: $VERSION"
