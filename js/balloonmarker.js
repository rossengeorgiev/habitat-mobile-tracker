/* A Bar is a simple overlay that outlines a lat/lng bounds on the
 * map. It has a border of the given weight and color and can optionally
 * have a semi-transparent background color.
 * @param latlng {GLatLng} Point to place bar at.
 * @param opts {Object Literal} Passes configuration options - 
 *   weight, color, height, width, text, and offset.
 */
var image_path = "http://spacenear.us/tracker/images/markers/";
var image_width = 46;
var image_height = 84;

var image_shadow = "http://spacenear.us/tracker/images/markers/shadow.png";
var image_shadow_width = 24;
var image_shadow_height = 16;
 
function BalloonMarker(latlng, opts) {
  this.latlng = latlng;

  if (!opts) opts = {};

  this.height_ = opts.height || image_height;
  this.width_ = opts.width || image_width;
  this.color_ = opts.color;
  this.mode_ = opts.mode? opts.mode : "balloon";
  this.clicked_ = 0;
  this.altitude_ = opts.altitude? opts.altitude : 0;
  this.img_ = opts.img;
}

/* BalloonMarker extends GOverlay class from the Google Maps API
 */
BalloonMarker.prototype = new GOverlay();

/* Creates the DIV representing this BalloonMarker.
 * @param map {GMap2} Map that bar overlay is added to.
 */
BalloonMarker.prototype.initialize = function(map) {
  var me = this;

  // Create the DIV representing our BalloonMarker
  var div = document.createElement("div");
  //div.style.border = "1px solid white";
  div.style.position = "absolute";
  div.style.paddingLeft = "0px";
  div.style.cursor = 'pointer';

  this.img_ = document.createElement("img");
  this.img_.src = image_path + me.mode_ + "-" + me.color_ + ".png";
  this.img_.style.width = me.width_ + "px";
  this.img_.style.height = me.height_ + "px";
  div.appendChild(this.img_);  
  
  if (me.color_ != "invisible") {
    div.style.background = 'url("' + image_shadow + '")';
    div.style.backgroundRepeat = 'no-repeat';
    div.style.backgroundPosition = "" + ((image_width - image_shadow_width)/2) + "px " + (image_height + me.altitude_ - image_shadow_height) + "px";
  }

  GEvent.addDomListener(this.img_, "click", function(event) {
    me.clicked_ = 1;
    GEvent.trigger(me, "click");
  });

  map.getPane(G_MAP_MARKER_PANE).appendChild(div);

  this.map_ = map;
  this.div_ = div;
};

/* Remove the main DIV from the map pane
 */
BalloonMarker.prototype.remove = function() {
  this.div_.parentNode.removeChild(this.div_);
};

/* Copy our data to a new BalloonMarker
 * @return {BalloonMarker} Copy of bar
 */
BalloonMarker.prototype.copy = function() {
  var opts = {};
  opts.height = this.height_;
  opts.width = this.width_;
  opts.color = this.color_;
  opts.mode = this.mode_;
  opts.altitude = this.altitude_;
  opts.img = this.img_;
  return new BalloonMarker(this.latlng, opts);
};

/* Redraw the BalloonMarker based on the current projection and zoom level
 * @param force {boolean} Helps decide whether to redraw overlay
 */
BalloonMarker.prototype.redraw = function(force) {

  // We only need to redraw if the coordinate system has changed
  if (!force) return;

  // Calculate the DIV coordinates of two opposite corners 
  // of our bounds to get the size and position of our BalloonMarker
  if(!this.latlng) return;
  var divPixel = this.map_.fromLatLngToDivPixel(this.latlng);

  // Now position our DIV based on the DIV coordinates of our bounds
  this.div_.style.width = this.width_ + "px";
  this.div_.style.left = (divPixel.x - this.width_/2) + "px"
  this.div_.style.height = (this.height_ + this.altitude_) + "px";
  this.div_.style.top = (divPixel.y - this.height_ - this.altitude_ + image_shadow_height/2) + "px";
  this.div_.style.backgroundPosition = ((image_width - image_shadow_width)/2) + "px " + (image_height + this.altitude_ - image_shadow_height) + "px";
	this.div_.style.zIndex = Math.round(this.latlng.lat()*-100000);
};

BalloonMarker.prototype.getZIndex = function(m) {
  return GOverlay.getZIndex(marker.getPoint().lat())-m.clicked*10000;
}

BalloonMarker.prototype.getPoint = function() {
  return this.latlng;
};

BalloonMarker.prototype.setStyle = function(style) {
  for (s in style) {
    this.div_.style[s] = style[s];
  }
};

BalloonMarker.prototype.setImage = function(image) {
  this.div_.style.background = 'url("' + image + '")';
}

BalloonMarker.prototype.setAltitude = function(altitude) {
  this.altitude_ = altitude;
  this.redraw(true);
}

BalloonMarker.prototype.setMode = function(mode) {
  this.mode_ = mode;
  
  if(!this.img_) return;
  this.img_.src = image_path + this.mode_ + "-" + this.color_ + ".png";
  this.redraw(true);
}

BalloonMarker.prototype.openInfoWindowHtml = function(html) {
  this.map_.openInfoWindowHtml(this.latlng, html, {pixelOffset: new GSize(0, -this.altitude_)});
}

BalloonMarker.prototype.setLatLng = function(latlng) {
  this.latlng = latlng;
  this.redraw(true);
}

