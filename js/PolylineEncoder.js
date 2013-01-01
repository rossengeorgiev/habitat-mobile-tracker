// PolylineEncoder.js copyright Mark McClure  April/May 2007
//
// This software is placed explicitly in the public
// domain and may be freely distributed or modified.
// No warranty express or implied is provided.
//
// History:
// V 2.1  July 2007
//   Minor modification in distance function to enhance
//   speed.  Suggested by Joel Rosenberg.
// V 2.0 May 2007.
//   Major revisions include:
//     Incorporation of Douglas-Peucker algorithm
//     Encapsulation into the PolylineEncoder package.
// V 1.0 September 2006
//   Original version based on simple vertex reduction
// 
// This module defines a PolylineEncoder class to encode
// polylines for use with Google Maps together with a few
// auxiliary functions. Documentation at
// http://facstaff.unca.edu/mcmcclur/GoogleMaps/EncodePolyline/PolylineEncoder.html
//
// Google map reference including encoded polylines:
//   http://www.google.com/apis/maps/documentation/
//
// Details on the algorithm used here:
//   http://facstaff.unca.edu/mcmcclur/GoogleMaps/EncodePolyline/
//
// Constructor:
//   polylineEncoder = new PolylineEncoder(numLevels, 
//     zoomFactor, verySmall, forceEndpoints?);
// where numLevels and zoomFactor indicate how many 
// different levels of magnification the polyline has
// and the change in magnification between those levels,
// verySmall indicates the length of a barely visible 
// object at the highest zoom level, forceEndpoints 
// indicates whether or not the  endpoints should be 
// visible at all zoom levels.  forceEndpoints is 
// optional with a default value of true.  Probably 
// should stay true regardless.
// 
// Main methods:
// * PolylineEncoder.dpEncodeToPolyline(points, 
//     color?, weight?, opacity?)
// Accepts an array of latLng objects (see below) and
// optional style specifications.  Returns an encoded 
// polyline that may be directly overlayed on a Google 
// Map.  Requires that the Google Maps API be loaded.
//
// * PolylineEncoder.dpEncodeToPolygon(pointsArray, 
//     boundaryColor?, boundaryWeight?, boundaryOpacity?,
//     fillColor?, fillOpacity?, fill?, outline?)
// Accepts an array of arrays latLng objects and
// optional style specifications.  Returns an encoded 
// polylgon that may be directly overlayed on a Google 
// Map.  Requires that the Google Maps API be loaded.
//
//
// Convenience classes and methods:
// * PolylineEncoder.latLng
// Constructor:
//   myLatLng = new PolylineEncoder.latLng(y,x);
// The dpEncode* functions expect points in the
// form of an object with lat and lng methods.  A
// GLatLng as defined by the Google Maps API does 
// quite nicely.  If you're developing a javascript
// without loading the API, however, you can use
// a PolylineEncoder.latLng for this purpose.
// //
// PolylineEncoder.pointsToLatLngs
// Sometimes your points are defined in terms of an
// array of arrays, rather than an array of latLngs.
// PolylineEncoder.pointsToLatLngs converts to an array
// of arrays to an array of latLngs for use by the
// dpEncode functions.
// //
// PolylineEncoder.pointsToGLatLngs
// PolylineEncoder.pointsToGLatLngs is analagous to the 
// previous function, but it returns GLatLngs rather
// than PolylineEncoder.latLngs.  The first function may
// be used independently of Google Maps.  Use the second,
// if you need to use the result in a Goole Map function.
//
//
// Lower level methods
// PolylineEncoder.dpEncodeToJSON(points, 
//     color?, weight?, opacity?)
// Returns a legal argument to GPolyline.fromEncoded.
// //
// PolylineEncoder.dpEncode(points);
// This is where the real work is done.  The return value
// is a JSON object with properties named  encodedLevels,
// encdodedPoints and encodedPointsLiteral. These are
// strings which are acceptable input to the points and
// levels properties of the GPolyline.fromEncoded
// function. The encodedPoints string should be used for
// maps generated dynamically, while the
// encodedPointsLiteral string should be copied into a
// static document.
// 
// The standard disclaimers, such as "use at your own risk, 
// since I really don't have any idea what I'm doing," apply. 

// The constructor
PolylineEncoder = function(numLevels, zoomFactor, verySmall, forceEndpoints) {
  var i;
  if(!numLevels) {
    numLevels = 18;
  }
  if(!zoomFactor) {
    zoomFactor = 2;
  }
  if(!verySmall) {
    verySmall = 0.00001;
  }
  if(!forceEndpoints) {
    forceEndpoints = true;
  }
  this.numLevels = numLevels;
  this.zoomFactor = zoomFactor;
  this.verySmall = verySmall;
  this.forceEndpoints = forceEndpoints;
  this.zoomLevelBreaks = new Array(numLevels);
  for(i = 0; i < numLevels; i++) {
    this.zoomLevelBreaks[i] = verySmall*Math.pow(zoomFactor, numLevels-i-1);
  }
}

// The main function.  Essentially the Douglas-Peucker
// algorithm, adapted for encoding. Rather than simply
// eliminating points, we record their from the
// segment which occurs at that recursive step.  These
// distances are then easily converted to zoom levels.
PolylineEncoder.prototype.dpEncode = function(points) {
  var absMaxDist = 0;
  var stack = [];
  var dists = new Array(points.length);
  var maxDist, maxLoc, temp, first, last, current;
  var i, encodedPoints, encodedLevels;
  var segmentLength;
  
  if(points.length > 2) {
    stack.push([0, points.length-1]);
    while(stack.length > 0) {
      current = stack.pop();
      maxDist = 0;
      segmentLength = Math.pow(points[current[1]].lat()-points[current[0]].lat(),2) + 
        Math.pow(points[current[1]].lng()-points[current[0]].lng(),2);
      for(i = current[0]+1; i < current[1]; i++) {
        temp = this.distance(points[i], 
          points[current[0]], points[current[1]],
          segmentLength);
        if(temp > maxDist) {
          maxDist = temp;
          maxLoc = i;
          if(maxDist > absMaxDist) {
            absMaxDist = maxDist;
          }
        }
      }
      if(maxDist > this.verySmall) {
        dists[maxLoc] = maxDist;
        stack.push([current[0], maxLoc]);
        stack.push([maxLoc, current[1]]);
      }
    }
  }
  
  encodedPoints = this.createEncodings(points, dists);
  encodedLevels = this.encodeLevels(points, dists, absMaxDist);
  return {
    encodedPoints: encodedPoints,
    encodedLevels: encodedLevels,
    encodedPointsLiteral: encodedPoints.replace(/\\/g,"\\\\")
  }
}

PolylineEncoder.prototype.dpEncodeToJSON = function(points,
  color, weight, opacity) {
  var result;
  
  if(!opacity) {
    opacity = 0.9;
  }
  if(!weight) {
    weight = 3;
  }
  if(!color) {
    color = "#0000ff";
  }
  result = this.dpEncode(points);
  return {
    color: color,
    weight: weight,
    opacity: opacity,
    points: result.encodedPoints,
    levels: result.encodedLevels,
    numLevels: this.numLevels,
    zoomFactor: this.zoomFactor
  }
}

PolylineEncoder.prototype.dpEncodeToGPolyline = function(points,
  color, weight, opacity) {
  if(!opacity) {
    opacity = 0.9;
  }
  if(!weight) {
    weight = 3;
  }
  if(!color) {
    color = "#0000ff";
  }
  return new GPolyline.fromEncoded(
    this.dpEncodeToJSON(points, color, weight, opacity));
}

PolylineEncoder.prototype.dpEncodeToGPolygon = function(pointsArray,
  boundaryColor, boundaryWeight, boundaryOpacity,
  fillColor, fillOpacity, fill, outline) {
  var i, boundaries;
  if(!boundaryColor) {
    boundaryColor = "#0000ff";
  }
  if(!boundaryWeight) {
    boundaryWeight = 3;
  }
  if(!boundaryOpacity) {
    boundaryOpacity = 0.9;
  }
  if(!fillColor) {
    fillColor = boundaryColor;
  }
  if(!fillOpacity) {
    fillOpacity = boundaryOpacity/3;
  }
  if(fill==undefined) {
    fill = true;
  }
  if(outline==undefined) {
    outline = true;
  }
  
  boundaries = new Array(0);
  for(i=0; i<pointsArray.length; i++) {
    boundaries.push(this.dpEncodeToJSON(pointsArray[i],
      boundaryColor, boundaryWeight, boundaryOpacity));
  }
  return new GPolygon.fromEncoded({
    polylines: boundaries,
    color: fillColor,
    opacity: fillOpacity,
    fill: fill,
    outline: outline
  });
}

// distance(p0, p1, p2) computes the distance between the point p0
// and the segment [p1,p2].  This could probably be replaced with
// something that is a bit more numerically stable.
PolylineEncoder.prototype.distance = function(p0, p1, p2, segLength) {
  var u, out;
  
  if(p1.lat() === p2.lat() && p1.lng() === p2.lng()) {
    out = Math.sqrt(Math.pow(p2.lat()-p0.lat(),2) + Math.pow(p2.lng()-p0.lng(),2));
  }
  else {
    u = ((p0.lat()-p1.lat())*(p2.lat()-p1.lat())+(p0.lng()-p1.lng())*(p2.lng()-p1.lng()))/
      segLength;
  
    if(u <= 0) {
      out = Math.sqrt(Math.pow(p0.lat() - p1.lat(),2) + Math.pow(p0.lng() - p1.lng(),2));
    }
    if(u >= 1) {
      out = Math.sqrt(Math.pow(p0.lat() - p2.lat(),2) + Math.pow(p0.lng() - p2.lng(),2));
    }
    if(0 < u && u < 1) {
      out = Math.sqrt(Math.pow(p0.lat()-p1.lat()-u*(p2.lat()-p1.lat()),2) +
        Math.pow(p0.lng()-p1.lng()-u*(p2.lng()-p1.lng()),2));
    }
  }
  return out;
}

// The createEncodings function is very similar to Google's
// http://www.google.com/apis/maps/documentation/polyline.js
// The key difference is that not all points are encoded, 
// since some were eliminated by Douglas-Peucker.
PolylineEncoder.prototype.createEncodings = function(points, dists) {
  var i, dlat, dlng;
  var plat = 0;
  var plng = 0;
  var encoded_points = "";

  for(i = 0; i < points.length; i++) {
    if(dists[i] != undefined || i == 0 || i == points.length-1) {
      var point = points[i];
      var lat = point.lat();
      var lng = point.lng();
      var late5 = Math.floor(lat * 1e5);
      var lnge5 = Math.floor(lng * 1e5);
      dlat = late5 - plat;
      dlng = lnge5 - plng;
      plat = late5;
      plng = lnge5;
      encoded_points += this.encodeSignedNumber(dlat) + 
        this.encodeSignedNumber(dlng);
    }
  }
  return encoded_points;
}

// This computes the appropriate zoom level of a point in terms of it's 
// distance from the relevant segment in the DP algorithm.  Could be done
// in terms of a logarithm, but this approach makes it a bit easier to
// ensure that the level is not too large.
PolylineEncoder.prototype.computeLevel = function(dd) {
  var lev;
  if(dd > this.verySmall) {
    lev=0;
    while(dd < this.zoomLevelBreaks[lev]) {
      lev++;
    }
    return lev;
  }
}

// Now we can use the previous function to march down the list
// of points and encode the levels.  Like createEncodings, we
// ignore points whose distance (in dists) is undefined.
PolylineEncoder.prototype.encodeLevels = function(points, dists, absMaxDist) {
  var i;
  var encoded_levels = "";
  if(this.forceEndpoints) {
    encoded_levels += this.encodeNumber(this.numLevels-1)
  } else {
    encoded_levels += this.encodeNumber(
      this.numLevels-this.computeLevel(absMaxDist)-1)
  }
  for(i=1; i < points.length-1; i++) {
    if(dists[i] != undefined) {
      encoded_levels += this.encodeNumber(
        this.numLevels-this.computeLevel(dists[i])-1);
    }
  }
  if(this.forceEndpoints) {
    encoded_levels += this.encodeNumber(this.numLevels-1)
  } else {
    encoded_levels += this.encodeNumber(
      this.numLevels-this.computeLevel(absMaxDist)-1)
  }
  return encoded_levels;
}

// This function is very similar to Google's, but I added
// some stuff to deal with the double slash issue.
PolylineEncoder.prototype.encodeNumber = function(num) {
  var encodeString = "";
  var nextValue, finalValue;
  while (num >= 0x20) {
    nextValue = (0x20 | (num & 0x1f)) + 63;
//     if (nextValue == 92) {
//       encodeString += (String.fromCharCode(nextValue));
//     }
    encodeString += (String.fromCharCode(nextValue));
    num >>= 5;
  }
  finalValue = num + 63;
//   if (finalValue == 92) {
//     encodeString += (String.fromCharCode(finalValue));
//   }
  encodeString += (String.fromCharCode(finalValue));
  return encodeString;
}

// This one is Google's verbatim.
PolylineEncoder.prototype.encodeSignedNumber = function(num) {
  var sgn_num = num << 1;
  if (num < 0) {
    sgn_num = ~(sgn_num);
  }
  return(this.encodeNumber(sgn_num));
}


// The remaining code defines a few convenience utilities.
// PolylineEncoder.latLng
PolylineEncoder.latLng = function(y, x) {
	this.y = y;
	this.x = x;
}
PolylineEncoder.latLng.prototype.lat = function() {
	return this.y;
}
PolylineEncoder.latLng.prototype.lng = function() {
	return this.x;
}

// PolylineEncoder.pointsToLatLngs
PolylineEncoder.pointsToLatLngs = function(points) {
	var i, latLngs;
	latLngs = new Array(0);
	for(i=0; i<points.length; i++) {
		latLngs.push(new PolylineEncoder.latLng(points[i][0], points[i][1]));
	}
	return latLngs;
}

// PolylineEncoder.pointsToGLatLngs
PolylineEncoder.pointsToGLatLngs = function(points) {
	var i, gLatLngs;
	gLatLngs = new Array(0);
	for(i=0; i<points.length; i++) {
		gLatLngs.push(new GLatLng(points[i][0], points[i][1]));
	}
	return gLatLngs;
}
