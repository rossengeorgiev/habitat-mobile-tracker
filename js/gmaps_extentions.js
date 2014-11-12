
// custom label function

google.maps.Label = function(opt_options) {
    // init default values
    this.set('visible', true);
    this.set('opacity', 1);
    this.set('clickable', false);
    this.set('strokeColor', "#00F");
    this.set('text', "");
    this.set('textOnly', false); // true only text, false text within a box

    this.setValues(opt_options);

    var span = this.span_ = document.createElement('span');
    span.style.cssText = 'position: relative; left: -50%;' +
    'white-space: nowrap; color: #000;';

    span.style.cssText += !this.get('textOnly') ?
        'border: 1px solid '+this.get('strokeColor')+'; border-radius: 5px; ' +
        'top:-12px;font-size:9px;padding: 2px; background-color: white'
        :
        'top:-8px;font-size:12px;font-weight: bold; text-shadow: 2px 0 0 #fff, -2px 0 0 #fff, 0 2px 0 #fff, 0 -2px 0 #fff, 1px 1px #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff;'
        ;

    var div = this.div_ = document.createElement('div');
    div.appendChild(span);
    div.style.cssText = 'position: absolute; display: none';
};

google.maps.Label.prototype = new google.maps.OverlayView();


// Implement onAdd
google.maps.Label.prototype.onAdd = function() {
  var pane = this.getPanes().overlayImage;
  pane.appendChild(this.div_);

  // redraw if any option is changed
  var ctx = this;
  var callback = function() { ctx.draw(); };
  this.listeners_ = [
    google.maps.event.addListener(this, 'opacity_changed', callback),
    google.maps.event.addListener(this, 'position_changed', callback),
    google.maps.event.addListener(this, 'visible_changed', callback),
    google.maps.event.addListener(this, 'clickable_changed', callback),
    google.maps.event.addListener(this, 'text_changed', callback),
    google.maps.event.addListener(this, 'zindex_changed', callback),
    google.maps.event.addDomListener(this.div_, 'click', function() {
      if (me.get('clickable')) {
        google.maps.event.trigger(me, 'click');
      }
    })
  ];
};


// Implement onRemove
google.maps.Label.prototype.onRemove = function() {
  this.div_.parentNode.removeChild(this.div_);

  // remove all listeners
  for (var i = 0, j = this.listeners_.length; i < j; i++) {
    google.maps.event.removeListener(this.listeners_[i]);
  }
};


// Implement draw
google.maps.Label.prototype.draw = function() {
  var projection = this.getProjection();
  var position = projection.fromLatLngToDivPixel(this.get('position'));

  var div = this.div_;
  if(position !== null) {
      div.style.left = position.x + 'px';
      div.style.top = position.y + 'px';
  }

  div.style.display = this.get('visible') && this.get('opacity') >= 0.6 ? 'block' : 'none';
  this.span_.style.cursor = this.get('clickable') ? 'pointer' : '';
  div.style.zIndex = this.get('zIndex');
  this.span_.innerHTML = this.get('text').toString();
};
