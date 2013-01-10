#!/bin/bash
cd css
rm mobile.css
cat base.css skeleton.css layout.css habitat-font.css main.css > mobile.tmp
java -jar "../tools/yuicompressor-2.4.8pre.jar" --type=css mobile.tmp > mobile.css
rm mobile.tmp
