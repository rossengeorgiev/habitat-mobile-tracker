// This BDCCCircle is a VML/SVG overlay that shows a circle on the map
// You can specify the border width, colour and opacity 
// as well as whether the circle is filled or not and the fill colour and opacity.
// The radius of the circle is given in kilometers.
//
// For a gradiant fill, both fillColor and fillOpacity may be an array of length 2
//
// Events are 'click','mouseover' and 'mouseout' 
//
// If targeting MSIE remember to include the VML header material (see GMaps docs)
//
// Bill Chadwick 2007

var BDCCCircleId;

var BDCCCircleSvgRoot;

function BDCCCircle(point, radiusKm, strokeColor, strokeWeight, strokeOpacity, fill, fillColor, fillOpacity, tooltip) {

  this.point_ = point;
  this.radiusKm_ = radiusKm;
  this.lineColour_ = strokeColor || "#888888";
  this.lineWidth_ = strokeWeight || 3;
  this.lineOpacity_ = strokeOpacity || 0.5;
  this.fill_ = fill || false;
  
  this.fillColour_ = fillColor || "#444444";//save original object for copy
  if (this.fillColour_.constructor.toString().indexOf("Array") == -1){
      this.fillColour1_ = this.fillColour_;
      this.fillColour2_ = null;
  }
  else if (this.fillColour_.length == 2){
      this.fillColour1_ = this.fillColour_[0] || "#222222";
      this.fillColour2_ = this.fillColour_[1] || "#888888";
  }
  else{
      this.fillColour1_ = this.fillColour_[0] || "#444444";
      this.fillColour2_ = null;
  }
  
  this.fillOpacity_ = fillOpacity || 0.3;//save orgiginal for copy
  if (this.fillOpacity_.constructor.toString().indexOf("Array") == -1){
      this.fillOpacity1_ = this.fillOpacity_;
      this.fillOpacity2_ = null;
  }
  else if (this.fillOpacity_.length == 2){
      this.fillOpacity1_ = this.fillOpacity_[0] || 0.1;
      this.fillOpacity2_ = this.fillOpacity_[1] || 0.9;
  }
  else
  {
      this.fillOpacity1_ = this.fillOpacity_[0] || 0.5;
      this.fillOpacity2_ = null;
  }
  
  this.tooltip_ = tooltip;
  this.usesVml_ = (navigator.userAgent.indexOf("MSIE") != -1);
  
  if(BDCCCircleId == null)
    BDCCCircleId = 0;
  else
    BDCCCircleId += 1;
    
  this.gradId_ = "BDCCCircleGradient" + BDCCCircleId.toString();//for SVG gradient
   
}
BDCCCircle.prototype = new GOverlay();

//Get/Set methods

//Point or center
BDCCCircle.prototype.getPoint = function(){
    return this.point_;
}
BDCCCircle.prototype.setPoint = function(point){
    this.point_ = point;
    this.redraw(false);
}

// Radius
BDCCCircle.prototype.getRadiusKm = function(){
    return this.radiusKm_;
}
BDCCCircle.prototype.setRadiusKm = function(radiusKm){
    this.radiusKm_ = radiusKm;
    this.redraw(false);
}

//Stroke (line) colour
BDCCCircle.prototype.setStrokeColor = function(color) {
    this.lineColour_ = color;
    if(this.usesVml_){
        this.vmlCircle_.stroke.color = this.lineColour_;
    }
    else{
        this.svgNode_.setAttribute("stroke",this.lineColour_);
    }
}
BDCCCircle.prototype.getStrokeColor = function() {
    return this.lineColour_;
}

//Stroke (line) weight (pixels)
BDCCCircle.prototype.setStrokeWeight = function(weight) {
    this.lineWidth_ = weight;
    if(this.usesVml_){
        this.vmlCircle_.stroke.weight = this.lineWidth_.toString()+"px";   
    }
    else{
        this.svgNode_.setAttribute("stroke-width",this.lineWidth_.toString()+"px");
    }
}
BDCCCircle.prototype.getStrokeWeight = function() {
    return this.lineWidth_;
}

//Stroke (line) opacity 0.0 (transparent) to 1.0 (opaque)
BDCCCircle.prototype.setStrokeOpacity = function(opacity) {
    this.lineOpacity_ = opacity;
    if(this.usesVml_){
        this.vmlCircle_.stroke.opacity = this.lineOpacity_;
    }
    else{
        this.svgNode_.setAttribute("stroke-opacity",this.lineOpacity_);
    }
}
BDCCCircle.prototype.getStrokeOpacity = function() {
    return this.lineOpacity_;
}

//Fill colour
BDCCCircle.prototype.setFillColor = function(fillColor) {

  this.fillColour_ = fillColor || "#444444";//save original object for copy
  if (this.fillColour_.constructor.toString().indexOf("Array") == -1){
      this.fillColour1_ = this.fillColour_;
      this.fillColour2_ = null;
  }
  else if (this.fillColour_.length == 2){
      this.fillColour1_ = this.fillColour_[0] || "#222222";
      this.fillColour2_ = this.fillColour_[1] || "#888888";
  }
  else{
      this.fillColour1_ = this.fillColour_[0] || "#444444";
      this.fillColour2_ = null;
  }

    if(this.usesVml_)
        this.vmlFillHelper();
    else
        this.svgFillHelper();
}
BDCCCircle.prototype.getFillColor = function() {
    return this.fillColour_;
}

//Fill helper for vml, need this as can't script opacity2
BDCCCircle.prototype.vmlFillHelper = function() {
    this.vmlCircle_.removeChild(this.vmlCircle_.children[1]);
    
    f = "<v:fill";
    
    if(!this.fill_)
        f += " type='none'"; 
    else if((this.fillOpacity2_ != null) || (this.fillColour2_ != null))
        f += " type='gradientradial' focusposition='0.5,0.5' focussize='0,0' method='linear'";
    else
        f += " type='solid'"; 
        
    f += " opacity=" + this.fillOpacity1_;
    if(this.fillOpacity2_ != null)
        f += " o:opacity2=" + this.fillOpacity2_;
    else if (this.fillColour2_ != null)
        f += " o:opacity2=" + this.fillOpacity1_;   
    f += " color=" + this.fillColour1_;
    if(this.fillColour2_ != null)
        f += " color2=" + this.fillColour2_;     
    else if(this.fillOpacity2_ != null)
        f += " color2=" + this.fillColour1_;     
    f += "/>";
    
    this.vmlCircle_.appendChild(document.createElement(f));
}


BDCCCircle.prototype.svgFillHelper = function() {

    if(!this.fill_){
        this.svgNode_.setAttribute("fill-opacity","0.0");    
        this.svgNode_.setAttribute("pointer-events","visibleStroke");
        }
    else if((this.fillOpacity2_ == null) && (this.fillColour2_ == null)){
        this.svgNode_.setAttribute("fill",this.fillColour1_);
        this.svgNode_.setAttribute("fill-opacity",this.fillOpacity1_);    
        this.svgNode_.setAttribute("pointer-events","visibleFill");
        }
    else{
        this.svgNode_.setAttribute("fill","url(#" + this.gradId_ + ")");        
    
        this.svgStop2_.setAttribute("stop-opacity",this.fillOpacity1_);
        if(this.fillOpacity2_ != null)
            this.svgStop1_.setAttribute("stop-opacity",this.fillOpacity2_);
        else if (this.fillColour2_ != null)
            this.svgStop1_.setAttribute("stop-opacity",this.fillOpacity1_);

        this.svgStop2_.setAttribute("stop-color",this.fillColour1_);
        if(this.fillColour2_ != null)
            this.svgStop1_.setAttribute("stop-color",this.fillColour2_);
        else if(this.fillOpacity2_ != null)
            this.svgStop1_.setAttribute("stop-color",this.fillColour1_);
           
        this.svgNode_.setAttribute("pointer-events","visibleFill");
        }
}

//Fill opacity 0.0 (transparent) to 1.0 (opaque)
BDCCCircle.prototype.setFillOpacity = function(opacity) {

    this.fillOpacity_ = opacity || 0.3;//save orgiginal for copy
    if (this.fillOpacity_.constructor.toString().indexOf("Array") == -1){
        this.fillOpacity1_ = this.fillOpacity_;
        this.fillOpacity2_ = null;
    }
    else if (this.fillOpacity_.length == 2){
        this.fillOpacity1_ = this.fillOpacity_[0] || 0.1;
        this.fillOpacity2_ = this.fillOpacity_[1] || 0.9;
    }
    else
    {
        this.fillOpacity1_ = this.fillOpacity_[0] || 0.5;
        this.fillOpacity2_ = null;
    }
    
    if(this.usesVml_){
        if(this.fill_){      
            this.vmlCircle_.filled = true;        
            this.vmlFillHelper();
        }
    else
        this.vmlCircle_.filled = false;        
    }
    else{
        this.svgFillHelper();
    }
}
BDCCCircle.prototype.getFillOpacity = function() {
    return this.fillOpacity_;
}

// Fill on/off
BDCCCircle.prototype.setFill = function(fill) {
    this.fill_ = fill;
	this.setFillOpacity(this.fillOpacity_);
}
BDCCCircle.prototype.getFillOpacity = function() {
    return this.fill_;
}

//Event posters
BDCCCircle.prototype.onClick = function(){
    GEvent.trigger(this,"click");
}
BDCCCircle.prototype.onOver = function(){
    GEvent.trigger(this,"mouseover");
}
BDCCCircle.prototype.onOut = function(){
    GEvent.trigger(this,"mouseout");
}

// Creates the DIV representing this circle.
BDCCCircle.prototype.initialize = function(map) {

  //save for later
  this.map_ = map;

  //closures for dom event handlers
  var eClick = GEvent.callback(this,this.onClick);
  var eOver = GEvent.callback(this,this.onOver);
  var eOut = GEvent.callback(this,this.onOut);
  
  //set up invariant details
  if(this.usesVml_){

      try{

      var c = document.createElement("v:oval");
      c.style.position = "absolute";
      var s = document.createElement("v:stroke");
      c.insertBefore(s, null);
      var f = document.createElement("v:fill");
      c.insertBefore(f, null);
      if(this.tooltip_){
		c.title = this.tooltip_;
		c.style.cursor = "help";
	  }
	map.getPane(G_MAP_MAP_PANE).appendChild(c);
      
      GEvent.clearInstanceListeners(c);//safety 
      GEvent.addDomListener(c,"click",function(event){eClick();});
      GEvent.addDomListener(c,"mouseover",function(){eOver();});
      GEvent.addDomListener(c,"mouseout",function(){eOut();});
      
      this.vmlCircle_ = c;//save for drawing  
      
      }
      catch (ex)
      {
		alert("The designer of this Google Maps web page has attempted to use VML graphics without including the necessary header material.");
      }

  }
  else{


	var svgNS = "http://www.w3.org/2000/svg";

      if (BDCCCircleSvgRoot == null){
		// all the circles go in one SVG element - this makes the mouseover events work properly
		// without one circles bounding box occluding events from a lower z order circle
		BDCCCircleSvgRoot = document.createElementNS(svgNS, "svg");
		map.getPane(G_MAP_MAP_PANE).appendChild(BDCCCircleSvgRoot);
	}

	var svgDefs = document.createElementNS(svgNS, "defs");
	BDCCCircleSvgRoot .appendChild(svgDefs);

	var svgGrad = document.createElementNS(svgNS, "radialGradient");
    svgDefs.appendChild(svgGrad);
    svgGrad.setAttribute("id",this.gradId_);

	var s1 = document.createElementNS(svgNS, "stop");
    s1.setAttribute("offset","0.0");
	var s2 = document.createElementNS(svgNS, "stop");
    s2.setAttribute("offset","1.0");
    svgGrad.appendChild(s1);
    svgGrad.appendChild(s2);

	var svgNode = document.createElementNS(svgNS, "circle");
        if(this.tooltip_ != null){
		svgNode.setAttribute("title",this.tooltip_);
		svgNode.style.cursor = "help";
        } 
	BDCCCircleSvgRoot.appendChild(svgNode);
	
	GEvent.clearInstanceListeners(svgNode);//safety 
	GEvent.addDomListener(svgNode,"click",function(event){eClick();});
	GEvent.addDomListener(svgNode,"mouseover",function(){eOver();});
	GEvent.addDomListener(svgNode,"mouseout",function(){eOut();});

	this.svgNode_ = svgNode;
	this.svgGrad_ = svgGrad;
	this.svgStop1_ = s1;
	this.svgStop2_ = s2;

  }
  
   //set up the appearance of our circle
   this.setStrokeColor(this.lineColour_);
   this.setStrokeOpacity(this.lineOpacity_);
   this.setStrokeWeight(this.lineWidth_);
   this.setFillColor(this.fillColour_);
   this.setFillOpacity(this.fillOpacity_);//does fill too
  
}

// Remove the main DIV from the map pane
BDCCCircle.prototype.remove = function() {

  if (this.svgNode_ != null){
    GEvent.clearInstanceListeners(this.svgNode_);//safety 
    BDCCCircleSvgRoot.removeChild(this.svgNode_);
    this.svgNode_ = null;
  }
  if (this.vmlCircle_ != null){
    GEvent.clearInstanceListeners(this.vmlCircle_);//safety 
    this.map_.getPane(G_MAP_MAP_PANE).removeChild(this.vmlCircle_);
    this.vmlCircle_ = null;    
  }
  
}

// Copy our data to a new BDCCCircle
BDCCCircle.prototype.copy = function() {
  return new BDCCCircle(
      this.point_, 
      this.radiusKm_, 
      this.lineColour_, 
      this.lineWidth_, 
      this.lineOpacity_, 
      this.fill_, 
      this.fillColour_, 
      this.fillOpacity_, 
      this.tooltip_ 
  );
}

// Redraw the circle based on the current projection and zoom level
BDCCCircle.prototype.redraw = function(force) {
	
  // Calculate the DIV coordinates of the centre point of our circle
  if(!this.point_) return;
  var p = this.map_.fromLatLngToDivPixel(this.point_);
  
  //get the radius
  var sz = this.map_.getSize();
  var bnds = this.map_.getBounds();
  var pxDiag = Math.sqrt((sz.width*sz.width) + (sz.height*sz.height));
  var mDiagKm = bnds.getNorthEast().distanceFrom(bnds.getSouthWest()) / 1000.0;
  var pxPerKm = pxDiag/mDiagKm;

  //get the bounding square to the middle of the line
  var w2 = this.lineWidth_/2.0;
  var rPx = Math.round((this.radiusKm_ * pxPerKm) - w2);
  
  if(this.usesVml_){
  
    this.vmlCircle_.style.display="none";//while drawing or if 0 radius
    if(rPx > 0){
		var hw = rPx * 2;//width and height
		var hw2 = Math.round(hw/2.0);
		var t = p.y - hw2;//top
		var l = p.x - hw2;//left
		this.vmlCircle_.style.width = hw;
		this.vmlCircle_.style.height = hw;
		this.vmlCircle_.style.left = l;
		this.vmlCircle_.style.top = t;
		this.vmlCircle_.style.display="";//finished
		}
  }
  else{
    var rdrh = BDCCCircleSvgRoot.suspendRedraw(10000);//avoid double paint with new centre and then new radius

    this.svgNode_.setAttribute("visibility","hidden");//if 0 radius
    if((rPx > 0)&&(rPx < 3000)){
            var ne = this.map_.fromLatLngToDivPixel(bnds.getNorthEast());
            var sw = this.map_.fromLatLngToDivPixel(bnds.getSouthWest());

		var wd = ne.x-sw.x;
		var ht = sw.y-ne.y;
		var l = sw.x;
		var t = ne.y;

		BDCCCircleSvgRoot.setAttribute("width", wd);
		BDCCCircleSvgRoot.setAttribute("height", ht);
		BDCCCircleSvgRoot.setAttribute("style", "position:absolute; top:"+ t + "px; left:" + l + "px");
		
		var cx = p.x-l;
		var cy = p.y-t;

		this.svgNode_.setAttribute("overflow", "hidden");
		this.svgNode_.setAttribute("r",rPx);
		this.svgNode_.setAttribute("cx",cx);
		this.svgNode_.setAttribute("cy",cy);
		this.svgNode_.setAttribute("visibility","visible");//finished

		
	}
    BDCCCircleSvgRoot.unsuspendRedraw(rdrh);
    BDCCCircleSvgRoot.forceRedraw();
  }

}





