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
rm -f mobile.js
# precompiled libs
cat jquery* iscroll.js >> mobile.js

# compile the rest
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge chasecar.lib.js >> mobile.js
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge nite-overlay.js >> mobile.js
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge tracker.js >> mobile.js
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=js --disable-optimizations --nomunge app.js >> mobile.js

cd ..
echo "Done!"
