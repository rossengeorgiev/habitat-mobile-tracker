var mission_id = 0;
var position_id = 0;
var data_url = "http://spacenear.us/tracker/data.php?vehicles=";
var receivers_url = "http://spacenear.us/tracker/receivers.php";
var predictions_url = "http://spacenear.us/tracker/get_predictions.php";
var host_url = "";
var markers_url = "img/markers/";
var vehicle_names = [];
var vehicles = [];

var graph_url = "http://chart.googleapis.com/chart?chf=bg,s,67676700&chxr=0,0,46|1,0,0|2,0,45&chxs=0,676767,0,0,_,000000|1,676767,0,0,t,676767|2,676767,0,0,_,676767&chxt=r,y,x&chs=300x80&cht=lc&chco=33B5E5&chds=0,{AA}&chls=2&chm=B,33B5E533,0,0,0,-1&chd=";

var receiver_names = [];
var receivers = [];

var num_updates = 0;
var got_positions = false;
var zoomed_in = false;
var max_positions = 0; // maximum number of positions that ajax request should return (0 means no maximum)
var selector = null;
var window_selector = null;
var cursor = null;
var selected_vehicle = 0;
var follow_vehicle = -1;

var signals = null;
var signals_seq = -1;

var car_index = 0;
var car_colors = ["blue", "red", "green", "yellow"];
var balloon_index = 0;
var balloon_colors_name = ["red", "blue", "green", "yellow", "purple", "orange", "cyan"];
var balloon_colors = ["#f00", "blue", "green", "#ff0", "#c700e6", "#ff8a0f", "#0fffca"];

var map = null;
var overlay = null;

var notamOverlay = null;

// order of map elements
var Z_RANGE = 1;
var Z_STATION = 2;
var Z_PATH = 10;
var Z_CAR = 11;
var Z_SHADOW = 12;
var Z_PAYLOAD = 13;

var bootstrapped = false;
var zoom_timer;

// localStorage vars
var ls_receivers = false;
var ls_pred = false;

var plot = null;


var offline = {
    get: function(key) {
        if(typeof localStorage == 'undefined') return null;

        return JSON.parse(localStorage.getItem(key));
    },
    set: function(key, object) {
        if(typeof localStorage == 'undefined') return null;

        return localStorage.setItem(key, JSON.stringify(object));
    },
};

function load() {
    //initialize map object
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 5,
        center: new google.maps.LatLng(53.467511,-2.2338940),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        keyboardShortcuts: false,
        streetViewControl: false,
        rotateControl: false,
        panControl: false,
        scaleControl: false,
        zoomControl: true,
        zoomControlOptions: {
            style: google.maps.ZoomControlStyle.DEFAULT
        },
        scrollwheel: true
    });

    if(currentPosition) updateCurrentPosition(currentPosition.lat, currentPosition.lon);

    nite.init(map);
    if(!offline.get('opt_daylight')) nite.hide();
    setInterval(function() { nite.refresh(); }, 60000); // 1min

    // we need a dummy overlay to access getProjection()
    overlay = new google.maps.OverlayView();
    overlay.draw = function() {};
    overlay.setMap(map);

    google.maps.event.addListener(map, 'idle', function() {
        updateZoom();
    });

    // only start population the map, once its completely loaded
    google.maps.event.addListenerOnce(map, 'idle', function(){
        startAjax();
    });
}

function unload() {
  google.maps.Unload();
}

function panTo(vehicle_index) {
  if(vehicles[vehicle_index].marker_shadow) map.panTo(vehicles[vehicle_index].marker_shadow.getPosition());
  else map.panTo(vehicles[vehicle_index].marker.getPosition());
}

function optional(caption, value, postfix) {
  // if(value && value != '') {
  if (value !== '') {
    if(value.indexOf("=") == -1) {
      return "<b>" + caption + ":</b> " + value + postfix + "<br />"
    } else {
      var a = value.split(";");
      var result = "";
      for(var i = 0,ii = a.length; i < ii; i++) {
        var b = a[i].split("=");
        result += "<b>" + b[0] + ":</b> " + b[1] + "<br />"
      }
      return result;
    }
  } else {
    return "";
  }
}

function title_case(s) {
  return s.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function guess_name(key) {
  return title_case(key.replace(/_/g, " "));
}

function habitat_data(jsondata) {
  var keys = {
    "ascentrate": "Ascent Rate",
    "battery_percent": "Battery",
    "temperature_external": "Temperature, External",
    "pressure_internal": "Pressure, Internal",
    "voltage_solar_1": "Voltage, Solar 1",
    "voltage_solar_2": "Voltage, Solar 2",
    "light_red": "Light (Red)",
    "light_green": "Light (Green)",
    "light_blue": "Light (Blue)",
    "gas_a": "Gas (A)",
    "gas_b": "Gas (B)",
    "gas_co2": "Gas (CO)",
    "gas_combustible": "Gas (Combustible)",
    "radiation": "Radiation (CPM)",
    "temperature_radio": "Temperature, Radio",
    "uplink_rssi": "Uplink RSSI",
    "light_intensity": "Light Intensity",
    "light_intensity": "Light Intensity"
  }

  var hide_keys = {
    "spam": true,
    "battery_millivolts": true,
    "temperature_internal_x10": true,
    "uplink_rssi_raw": true
  }

  var suffixes = {
    "battery": "V",
    "temperature": "&deg;C",
    "temperature_external": "&deg;C",
    "temperature_radio": "&deg;C",
    "pressure": "Pa",
    "voltage_solar_1": "V",
    "voltage_solar_2": "V",
    "battery_percent": "%",
    "uplink_rssi": "dBm",
    "rssi_last_message": "dBm",
    "rssi_floor": "dBm",
    "iss_azimuth": "&deg;",
    "iss_elevation": "&deg;",
    "light_intensity": "lx",
    "spam": ""
  }

  try
  {
    if (jsondata === undefined || jsondata === "")
      return "";

    var data = $.parseJSON(jsondata);
    var array = [];
    var output = "";

    for(var key in data) {
        array.push([key, data[key]]);
    }

    array.sort(function(a, b) {
        return a[0].localeCompare(b[0]);
    });

    for(var i = 0, ii = array.length; i < ii; i++) {
      var k = array[i][0]; // key
      var v = array[i][1]; // value
      if (hide_keys[k] === true)
        continue;

      var name = "", suffix = "";
      if (keys[k] !== undefined)
        name = keys[k];
      else
        name = guess_name(k);

      if (suffixes[k] !== undefined)
        suffix = " " + suffixes[k];

      output += "<dt>" + v + suffix + "</dt><dd>" + name + "</dd>";
    }
    return output;
  }
  catch (error)
  {
    //if (jsondata && jsondata != '')
    // return "<b>Data:</b> " + jsondata + "<br /> ";
    //else
      return "";
  }
}

function updateAltitude(index) {
  var pixel_altitude = 0;
  var zoom = map.getZoom();
  var position = vehicles[index].curr_position;

  if(vehicles[index].marker.mode == 'landed') return;

  if(zoom > 18) zoom = 18;
  if(position.gps_alt > 0) {
    pixel_altitude = Math.round(position.gps_alt/(1000/3)*(zoom/18.0));
  }
  if(position.vehicle.toLowerCase().indexOf("iss") != -1) {
    pixel_altitude = Math.round(40000/(1000/3)*(zoom/18.0));
  } else if(position.gps_alt > 55000) {
    position.gps_alt = 55000;
  }
  vehicles[index].marker.setAltitude(pixel_altitude);
}

function updateZoom() {
  for(var index = 0, ii = vehicles.length; index < ii; index++) {
    if(vehicles[index].vehicle_type == "balloon") {
      updateAltitude(index);
    }
  }
}


function stopFollow() {
	if(follow_vehicle != -1) {
        vehicles[follow_vehicle].follow = false;
        follow_vehicle = -1;
    }
}

function followVehicle(index) {
    if(vehicles.length < 1) return;

	if(follow_vehicle != -1) vehicles[follow_vehicle].follow = false;

	if(follow_vehicle == index) {
        vehicles[follow_vehicle].follow = false;
        follow_vehicle = -1;
    } else if(follow_vehicle != index) {
		follow_vehicle = index;
		vehicles[follow_vehicle].follow = true;
        panTo(index);

        updateGraph(index, true);
	}
}

function roundNumber(number, digits) {
  var multiple = Math.pow(10, digits);
  var rndedNum = Math.round(number * multiple) / multiple;
  return rndedNum;
}

function updateVehicleInfo(index, position) {
  var latlng = new google.maps.LatLng(position.gps_lat, position.gps_lon);
  if(vehicles[index].marker_shadow) vehicles[index].marker_shadow.setPosition(latlng);
  vehicles[index].marker.setPosition(latlng);
  if(vehicles[index].vehicle_type == "balloon") {
    updateAltitude(index);
    var horizon_km = Math.sqrt(12.756 * position.gps_alt);
    vehicles[index].horizon_circle.setRadius(Math.round(horizon_km)*1000);

    if(vehicles[index].subhorizon_circle) {
      // see: http://ukhas.org.uk/communication:lineofsight
      var el = 5.0; // elevation above horizon
      var rad = 6378.10; // radius of earth
      var h = position.gps_alt / 1000; // height above ground

      var elva = el * Math.PI / 180.0;
      var slant = rad*(Math.cos(Math.PI/2+elva)+Math.sqrt(Math.pow(Math.cos(Math.PI/2+elva),2)+h*(2*rad+h)/Math.pow(rad,2)));
      var x = Math.acos((Math.pow(rad,2)+Math.pow(rad+h,2)-Math.pow(slant,2))/(2*rad*(rad+h)))*rad;

      var subhorizon_km = x;
      vehicles[index].subhorizon_circle.setRadius(Math.round(subhorizon_km)*1000);
    }

    // indicates whenever a payload has landed
    var landed = (
                     vehicles[index].max_alt > 1500         // if it has gone up
                     && vehicles[index].ascent_rate < 1.0   // and has negative ascent_rate, aka is descending
                     && position.gps_alt < 350              // and is under 350 meters altitude
                 ) || (                                     // or
                     position.gps_alt < 600                 // under 600m and has no position update for more than 30 minutes
                     && (new Date((new Date()).toISOString())).getTime() - (new Date(position.gps_time + " UTC")).getTime() > 1800000
                 );

    if(landed) {
      vehicles[index].marker.setMode("landed");
      vehicles[index].marker.shadow.setVisible(false);
      vehicles[index].horizon_circle.setVisible(false);
      vehicles[index].subhorizon_circle.setVisible(false);

    } else if(vehicles[index].ascent_rate > -3.0 ||
              vehicle_names[index] == "wb8elk2") {
    	vehicles[index].marker.setMode("balloon");
    } else {
    	vehicles[index].marker.setMode("parachute");
    }
  }

  var pixels = Math.round(position.gps_alt / 500) + 1;
  if (pixels < 0) {
    pixels = 0;
  } else if (pixels >= 98) {
    pixels = 98;
  }

  var image = vehicles[index].image_src;

  var elm = $('.vehicle' + index);
  if (elm.length == 0) {
    $('.portrait').append('<div class="row vehicle'+index+'"></div>');
    $('.landscape').append('<div class="row vehicle'+index+'"></div>');

  }

  var imp = offline.get('opt_imperial');
  var ascent_text = imp ? (vehicles[index].ascent_rate * 196.850394).toFixed(1) + ' ft/min' : vehicles[index].ascent_rate.toFixed(1) + ' m/s';
  var hrate_text = imp ? (vehicles[index].horizontal_rate * 196.850394).toFixed(1) + ' ft/min' : vehicles[index].horizontal_rate.toFixed(1) + ' m/s';

  var coords_text;
  var ua =  navigator.userAgent.toLowerCase();
  // determine how to link the vehicle coordinates to a native app, if on a mobile device
  if(ua.indexOf('iphone') > -1) {
      coords_text = '<a id="launch_mapapp" href="maps://?q='+position.gps_lat+','+position.gps_lon+'">'
                    + roundNumber(position.gps_lat, 6) + ', ' + roundNumber(position.gps_lon, 6) +'</a>'
                    + ' <i class="icon-location"></i>';
  } else if(ua.indexOf('android') > -1) {
      coords_text = '<a id="launch_mapapp" href="geo:'+position.gps_lat+','+position.gps_lon+'?q='+position.gps_lat+','+position.gps_lon+'('+vehicle_names[index]+')">'
                    + roundNumber(position.gps_lat, 6) + ', ' + roundNumber(position.gps_lon, 6) +'</a>'
                    + ' <i class="icon-location"></i>';
  } else {
      coords_text = roundNumber(position.gps_lat, 6) + ', ' + roundNumber(position.gps_lon, 6);
  }


  // start
  var a    = '<div class="header">'
           + '<span>' + vehicle_names[index] + '</span>'
           + '<img class="graph" src="img/blank.png">'
           + '<i class="arrow"></i></div>'
           + '<div class="data">'
           + '<img class="'+((vehicles[index].vehicle_type=="car")?'car':'')+'" src="'+image+'" />'
           + '<div class="left">'
           + '<dl>';
  // end
  var b    = '</dl>'
           + '</div>' // right
           + '</div>' // data
           + '';
  var c    = '<dt class="receivers">Recieved by:</dt><dd class="receivers">'
           + position.callsign.split(",").join(", ") + '</dd>'

  if(!position.callsign) c = '';

  // mid for portrait
  var p    = '<dt>'+position.gps_time+'</dt><dd>datetime</dd>'
           + '<dt>'+coords_text+'</dt><dd>coordinates</dd>'
           + c // receivers if any
           + '</dl>'
           + '</div>' // left
           + '<div class="right">'
           + '<dl>'
           + ((vehicles[index].vehicle_type == "car") ? '' : '<dt>'+ascent_text+' '+hrate_text+'</dt><dd>rate v|h</dd>')
           + '<dt>'+((imp) ? parseInt(3.2808399 * position.gps_alt) + ' ft': parseInt(position.gps_alt) + ' m')+'</dt><dd>altitude</dd>'
           + '<dt>'+((imp) ? parseInt(3.2808399 * vehicles[index].max_alt) + ' ft': parseInt(vehicles[index].max_alt) + ' m')+'</dt><dd>max alt</dd>'
           + '';
  // mid for landscape
  var l    = ((vehicles[index].vehicle_type == "car") ? '' : '<dt>'+ascent_text+' '+hrate_text+'</dt><dd>rate v|h</dd>')
           + '<dt>'+((imp) ? parseInt(3.2808399 * position.gps_alt) + 'ft': parseInt(position.gps_alt) + 'm')+' ('+((imp) ? parseInt(3.2808399 * vehicles[index].max_alt) + 'ft' : parseInt(vehicles[index].max_alt) + 'm')+')</dt><dd>altitude (max)</dd>'
           + '<dt>'+position.gps_time+'</dt><dd>datetime</dd>'
           + '<dt>'+coords_text+'</dt><dd>coordinates</dd>'
           + habitat_data(position.data)
           + c // receivers if any
           + '';


  $('.portrait .vehicle'+index).html(a + p + b);
  $('.landscape .vehicle'+index).html(a + l + b);

  return true;
}

function pad(number, length) {
  var str = '' + number;
  while (str.length < length) {
      str = '0' + str;
  }
  return str;
}

function addMarker(icon, latlng) {
    var marker = new google.maps.Marker({
        position: latlng,
        optimized: false,
        zIndex: Z_SHADOW,
        icon: {
            url: icon,
            scaledSize: new google.maps.Size(20,20),
            size: new google.maps.Size(20,20),
            anchor: new google.maps.Point(10, 10)
        },
        map: map,
        clickable: false
    });

    return marker;
}

function removePrediction(vehicle_index) {
  if(vehicles[vehicle_index].prediction_polyline) {
    vehicles[vehicle_index].prediction_polyline.setMap(null);
    vehicles[vehicle_index].prediction_polyline = null;
  }
  if(vehicles[vehicle_index].prediction_target) {
    vehicles[vehicle_index].prediction_target.setMap(null);
    vehicles[vehicle_index].prediction_target = null;
  }
  if(vehicles[vehicle_index].prediction_burst) {
    vehicles[vehicle_index].prediction_burst.setMap(null);
    vehicles[vehicle_index].prediction_burst = null;
  }
}

function redrawPrediction(vehicle_index) {
    var vehicle = vehicles[vehicle_index];
	var data = vehicle.prediction.data;
	if(data.warnings || data.errors) return;

    var line = [];
    var latlng = null;
    var max_alt = -99999;
    var latlng_burst = null;
    var	burst_index = 0;
    for(var i = 0, ii = data.length; i < ii; i++) {
        latlng = new google.maps.LatLng(data[i].lat, data[i].lon);
        line.push(latlng);
        if(parseFloat(data[i].alt) > max_alt) {
            max_alt = parseFloat(data[i].alt);
            latlng_burst = latlng;
            burst_index = i;
        }
    }

    if(typeof vehicle.prediction_polyline !== 'undefined') {
        vehicle.prediction_polyline.setPath(line);
    } else {
        vehicle.prediction_polyline = new google.maps.Polyline({
            map: map,
            zIndex: Z_PATH,
            path: line,
            strokeColor: balloon_colors[vehicle.color_index],
            strokeOpacity: 0.4,
            strokeWeight: 3,
            clickable: false,
            draggable: false,
        });
    }
    var image_src;
    if(vehicle_names[vehicle_index] != "wb8elk2") { // WhiteStar
        /*
        //icon.infoWindowAnchor = new google.maps.Point(13,5);

        var time = new Date(data[data.length-1].time * 1000);
        var time_string = pad(time.getUTCHours(), 2) + ':' + pad(time.getUTCMinutes(), 2) + ' UTC';
        var html = '<b>Predicted Landing</b><br />'
                   + '<p style="font-size: 10pt;">'
                   + data[data.length-1].lat + ', ' + data[data.length-1].lon + ' at ' + time_string
                   + '</p>';
        */
        var html = "";
        if(vehicle.prediction_target) {
            vehicle.prediction_target.setPosition(latlng);
        } else {
            image_src = host_url + markers_url + "target-" + balloon_colors_name[vehicle.color_index] + ".png";
            vehicle.prediction_target = addMarker(image_src, latlng);
        }
    } else {
        if(vehicle.prediction_target) vehicle.prediction_target = null;
    }

    if(burst_index != 0 && vehicle_names[vehicle_index] != "wb8elk2") {
        /*
        //icon.infoWindowAnchor = new google.maps.Point(18,5);

        var time = new Date(data[burst_index].time * 1000);
        var time_string = pad(time.getUTCHours(), 2) + ':' + pad(time.getUTCMinutes(), 2) + ' UTC';
        var html = '<b>Predicted Burst</b><br />'
                         + '<p style="font-size: 10pt;">'
                         + data[burst_index].lat + ', ' + data[burst_index].lon + ', ' + Math.round(data[burst_index].alt) + ' m at ' + time_string
                         + '</p>';
        */
        if(vehicle.prediction_burst) {
            vehicle.prediction_burst.setPosition(latlng_burst);
        } else {
            image_src = host_url + markers_url + "balloon-pop.png";
            vehicle.prediction_burst = addMarker(image_src, latlng_burst);
        }
    } else {
        if(vehicle.prediction_burst) vehicle.prediction_burst = null;
    }
}

function updatePolyline(vehicle_index) {
    for(k in vehicles[vehicle_index].polyline) {
        vehicles[vehicle_index].polyline[k].setPath(vehicles[vehicle_index].positions);
    }
}

function convert_time(gps_time) {
  // example: "2009-05-28 20:29:47"
  /*
  year = parseInt(gps_time.substring(0, 4), 10);
  month = parseInt(gps_time.substring(5, 7), 10);
  day = parseInt(gps_time.substring(8, 10), 10);
  hour = parseInt(gps_time.substring(11, 13), 10);
  minute = parseInt(gps_time.substring(14, 16), 10);
  second = parseInt(gps_time.substring(17), 10);

  date = new Date();
  date.setUTCFullYear(year);
  date.setUTCMonth(month-1);
  date.setUTCDate(day);
  date.setUTCHours(hour);
  date.setUTCMinutes(minute);
  date.setUTCSeconds(second);
  */

  return (new Date(gps_time)).getTime() / 1000; // seconds since 1/1/1970 @ 12:00 AM
}

var GChartString = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function GChartEncodeData(valueArray,maxValue) {
    var chartData = ['s:'];
    for (var i = 0; i < valueArray.length; i++) {
        var currentValue = valueArray[i];

        if (!isNaN(currentValue) && currentValue >= 0) {
            chartData.push(GChartString.charAt(Math.round((GChartString.length-1) * currentValue / maxValue)));
        } else {
            chartData.push('_');
        }
    }
    return chartData.join('');
}

function addPosition(position) {
    position.gps_time = position.gps_time.replace(/(\d+)-(\d+)-(\d+)/,"$2/$3/$1");

    // check if the vehicle is already in the list, if not create a new item
    if($.inArray(position.vehicle, vehicle_names) == -1) {
        vehicle_names.push(position.vehicle);
        var marker = null;
        var marker_shadow = null;
        var vehicle_type = "";
        var horizon_circle = null;
        var subhorizon_circle = null;
        var point = new google.maps.LatLng(position.gps_lat, position.gps_lon);
        var image_src = "";
        var color_index = 0;
        if(position.vehicle.search(/(chase)|(car)/i) != -1  // whitelist
           && position.vehicle.search(/icarus/i) == -1) {  // blacklist
            vehicle_type = "car";
            color_index = car_index++;
            var c = color_index % car_colors.length;
            var image_src = host_url + markers_url + "car-" + car_colors[c] + ".png";

            marker = new google.maps.Marker({
                icon: {
                    url: image_src,
                    size: new google.maps.Size(55,25),
                    scaledSize: new google.maps.Size(55,25)
                },
                zIndex: Z_CAR,
                position: point,
                map: map,
                optimized: false,
                title: position.vehicle
            });
        } else {
            vehicle_type = "balloon";
            color_index = balloon_index++;
            var c = color_index % balloon_colors.length;

            image_src = host_url + markers_url + "balloon-" + ((position.vehicle == "PIE") ? "rpi" : balloon_colors_name[c]) + ".png";
            marker_shadow = new google.maps.Marker({
                map: map,
                zIndex: Z_SHADOW,
                optimized: false,
                position: point,
                icon: {
                    url: host_url + markers_url + "shadow.png",
                    size: new google.maps.Size(24,16),
                    scaledSize: new google.maps.Size(24,16),
                    anchor: new google.maps.Point(12,8)
                },
                clickable: false
            });
            marker = new google.maps.Marker({
                map: map,
                optimized: false,
                zIndex: Z_PAYLOAD,
                position: point,
                icon: {
                            url: image_src,
                            size: new google.maps.Size(46,84),
                            scaledSize: new google.maps.Size(46,84)
                },
                title: position.vehicle,
            });
            marker.shadow = marker_shadow;
            marker.balloonColor = (position.vehicle == "PIE") ? "rpi" : balloon_colors_name[c];
            marker.mode = 'balloon';
            marker.setMode = function(mode) {
                this.mode = mode;
                var img;
                if(mode == "landed") {
                    img = {
                            url: host_url + markers_url + "payload-" + this.balloonColor + ".png",
                            size: new google.maps.Size(17,18),
                            scaledSize: new google.maps.Size(17,18),
                            anchor: new google.maps.Point(8,14)
                        };
                } else if(mode == "parachute") {
                    img = {
                            url: host_url + markers_url + "parachute-" + this.balloonColor + ".png",
                            size: new google.maps.Size(46,84),
                            scaledSize: new google.maps.Size(46,84)
                        };
                } else {
                    img = {
                            url: host_url + markers_url + "balloon-" + this.balloonColor + ".png",
                            size: new google.maps.Size(46,84),
                            scaledSize: new google.maps.Size(46,84)
                        };
                }
                this.setIcon(img);
            }
            marker.setAltitude = function(alt) {
                var pos = overlay.getProjection().fromLatLngToDivPixel(this.shadow.getPosition());
                pos.y -= alt;
                this.setPosition(overlay.getProjection().fromDivPixelToLatLng(pos));
            }
            marker.setAltitude(0);

            horizon_circle = new google.maps.Circle({
                map: map,
                zIndex: Z_RANGE,
                radius: 1,
                fillColor: '#00F',
                fillOpacity: 0,
                strokeColor: '#00F',
                strokeOpacity: 0.6,
                strokeWeight: 3,
                clickable: false,
                editable: false
            });
            horizon_circle.bindTo('center', marker_shadow, 'position');
            subhorizon_circle = new google.maps.Circle({
                map: map,
                radius: 1,
                zIndex: Z_RANGE,
                fillColor: '#0F0',
                fillOpacity: 0,
                strokeColor: '#0F0',
                strokeOpacity: 0.8,
                strokeWeight: 3,
                clickable: false,
                editable: false
            });
            subhorizon_circle.bindTo('center', marker_shadow, 'position');
        }
        var vehicle_info = {vehicle_type: vehicle_type,
                            ascent_rate: 0,
                            marker: marker,
                            marker_shadow: marker_shadow,
                            image_src: image_src,
                            horizon_circle: horizon_circle,
                            subhorizon_circle: subhorizon_circle,
                            num_positions: 0,
                            positions: [],
                            curr_position: position,
                            line: [],
                            polyline: [new google.maps.Polyline({
                                map: map,
                                zIndex: Z_PATH,
                                strokeColor: balloon_colors[c],
                                strokeOpacity: 0.8,
                                strokeWeight: 3,
                                clickable: false,
                                draggable: false,
                            })],
                            prediction: null,
                            ascent_rate: 0.0,
                            horizontal_rate: 0.0,
                            max_alt: parseFloat(position.gps_alt),
                            path_enabled: vehicle_type == "balloon" && position.vehicle.toLowerCase().indexOf("iss") == -1,
                            follow: false,
                            color_index: c,
                            prediction_traget: null,
                            prediction_burst: null,
                            alt_list: [0],
                            time_last_alt: 0,
                            alt_max: 100,
                            graph_data_updated: false,
                            graph_data: [],
                            graph_yaxes: []
                            };

        // deep copy yaxes config for graph
        if(plot) $.each($.extend(false, plot_options.yaxes, {}), function(k,v) { vehicle_info.graph_yaxes.push(v) });

        // nyan mod
        if(window.location.search == "?nyan" && vehicle_info.vehicle_type == "balloon") {
           // form a nyancat
           vehicle_info.marker.setMap(null);
           vehicle_info.marker.setMode = function(derp) {};
           vehicle_info.marker_shadow = new google.maps.Marker({
                map: map,
                zIndex: Z_SHADOW,
                optimized: false,
                position: point,
                icon: {
                    url: host_url + markers_url + "nyan.gif",
                    size: new google.maps.Size(55,39),
                    scaledSize: new google.maps.Size(55,39),
                    anchor: new google.maps.Point(26,20)
                },
                clickable: false
            });
            // rebind horizon circles to follow nyan
            horizon_circle.bindTo('center', vehicle_info.marker_shadow, 'position');
            subhorizon_circle.bindTo('center', vehicle_info.marker_shadow, 'position');

            vehicle_info.image_src = host_url + markers_url + "hab_nyan.gif";

            // whats nyan only purpose? Make people happy, of course. And how?
            var rainbow = ["#ff0000", "#fc9a00", "#f6ff00", "#38ff01", "#009aff","#0000ff"];
            vehicle_info.polyline = [];

            for(k in rainbow) {
                vehicle_info.polyline.push(new google.maps.Polyline({
                                map: map,
                                zIndex: (Z_PATH - (k * 1)),
                                strokeColor: rainbow[k],
                                strokeOpacity: 1,
                                strokeWeight: (k*4) + 2,
                                clickable: false,
                                draggable: false,
                            }));
            }
        }

        // let the nyan free
        vehicles.push(vehicle_info);
    }


    var vehicle_index = $.inArray(position.vehicle, vehicle_names);
    var vehicle = vehicles[vehicle_index];

    if(vehicle.vehicle_type == "balloon") {
        var new_latlng = new google.maps.LatLng(position.gps_lat, position.gps_lon);

        // if position array has at least 1 position
        if(vehicle.num_positions > 0) {
            if(convert_time(vehicle.curr_position.gps_time) >= convert_time(position.gps_time)) {
                if (("," + vehicle.curr_position.callsign + ",").indexOf("," + position.callsign + ",") === -1) {
                  vehicle.curr_position.callsign += "," + position.callsign;
                }
            } else {

                var dt = convert_time(position.gps_time)
                   - convert_time(vehicle.curr_position.gps_time);

                if(dt != 0) {
                    // calcualte vertical rate
                    var rate = (position.gps_alt - vehicle.curr_position.gps_alt) / dt;
                    vehicle.ascent_rate = 0.7 * rate
                                          + 0.3 * vehicle.ascent_rate;

                    // calculate horizontal rate
                    vehicle.horizontal_rate = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(position.gps_lat, position.gps_lon),
                                                                                                    new google.maps.LatLng(vehicle.curr_position.gps_lat, vehicle.curr_position.gps_lon)) / dt;

                    // only record altitude values in 2minute interval
                    if(convert_time(vehicle.curr_position.gps_time) - vehicle.time_last_alt >= 120) { // 120s = 2minutes
                        vehicle.time_last_alt = convert_time(vehicle.curr_position.gps_time);
                        var alt = parseInt(vehicle.curr_position.gps_alt);

                        if(alt > vehicle.alt_max) vehicle.alt_max = alt; // larged value in the set is required for encoding later

                        vehicle.alt_list.push(alt); // push value to the list
                    }
                }

                if(vehicle.curr_position.gps_lat != position.gps_lat
                   || vehicle.curr_position.gps_lon != position.gps_lon) {
                    // add the new position
                    vehicle.positions.push(new_latlng);
                    vehicle.num_positions++;

                    vehicle.curr_position = position;
                    graphAddLastPosition(vehicle_index);
                }
            }
        } else {
            vehicle.positions.push(new_latlng);
            vehicle.num_positions++;
            vehicle.curr_position = position;
            graphAddLastPosition(vehicle_index);
        }
    } else { // if car
        vehicle.curr_position = position;
    }

    // record the highest altitude
    if(parseFloat(position.gps_alt) > vehicle.max_alt) {
        vehicle.max_alt = parseFloat(position.gps_alt);
    }

    return;
}

function updateGraph(idx, reset_selection) {
    if(!plot) return;

    if(polyMarker) polyMarker.setPosition(null);

    if(reset_selection) {
        delete plot_options.xaxis;

        // reset nite overlay
        nite.setDate(null);
        nite.refresh();
    }

    // replot graph, with this vehicle data, and this vehicles yaxes config
    plot = $.plot(plot_holder, vehicles[idx].graph_data, $.extend(false, plot_options, {yaxes:vehicles[idx].graph_yaxes}));
}

function graphAddLastPosition(idx) {
    if(!plot) return;

    vehicles[idx].graph_data_updated = true;
    var data = vehicles[idx].graph_data;
    var new_data = vehicles[idx].curr_position;
    var date = new Date(new_data.gps_time);
    var tz_offset_milis = date.getTimezoneOffset() * 60000;
    var ts = date.getTime() - tz_offset_milis;

    if(vehicles[idx].graph_data.length) {
        var ts_last_idx = data[0].data.length - 1;
        var ts_last = data[0].data[ts_last_idx][0];

        //insert gap when there are 3mins, or more, without telemetry
        var gap_size = 180000; // 3 mins in milis

        if(ts_last + gap_size < ts) {
            $.each(data, function(k,v) {
                v.data.push([ts_last+gap_size, v.data[v.data.length - 1][1]]);
                v.data.push([ts_last+gap_size+1, null]);
                v.nulls += 2;
            })
        }

        // update the selection upper limit to the latest timestamp, only if the upper limit is equal to the last timestamp
        if(plot_options.xaxis && follow_vehicle == idx && ts_last == plot_options.xaxis.max) plot_options.xaxis.max = ts;
    }

    var i = 0;
    // altitude is always first in the series
    if(data[i] === undefined) {
        data[i] = {
                    label: "altitude = 0",
                    color: '#33B5E5',
                    yaxis: i+1,
                    lines: { show:true, fill: true, fillColor: "rgba(51, 181, 229, 0.1)" },
                    nulls: 0,
                    data: []
                  };
    }

    // push latest altitude
    data[0].data.push([ts, parseInt(new_data.gps_alt)]);
    if(parseInt(new_data.gps_alt) < 0) delete vehicles[idx].graph_yaxes[i].min;
    i++;

    // the rest of the series is from the data field
    var json = $.parseJSON(new_data.data);
    if(!json) return;

    $.each(json, function(k, v) {
        if(isNaN(v) || v=="") return;        // only take data that is numerical
        if(i >= 8) return;  // up to 8 seperate data plots

        if(data[i] === undefined) {
            data[i] = {
                        label: k + " = 0",
                        key: k,
                        yaxis: i + 1,
                        nulls: 0,
                        data: []
                      };

           if(isInt(v)) $.extend(true, data[i], { noInterpolate: true, lines: { steps: true }});
        }

        if(k != data[i].key) return;

        data[i].data.push([ts, parseFloat(v)]);
        if(parseFloat(v) < 0) delete vehicles[idx].graph_yaxes[i].min;

        i++;
    });
}

function refresh() {
  //status = '<img src="spinner.gif" width="16" height="16" alt="" /> Refreshing ...';
  //$('#status_bar').html(status);

  if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'ajax', 'refresh']);

  $.ajax({
    type: "GET",
    url: data_url,
    data: "format=json&position_id=" + position_id + "&max_positions=" + max_positions,
    dataType: "json",
    success: function(response, textStatus) {
        update(response);
    },
    error: function() {
        if(!zoomed_in && offline.get('opt_offline')) update(offline.get('positions'));
    },
    complete: function(request, textStatus) {
        periodical = setTimeout(refresh, timer_seconds * 1000);
    }
  });
}

function refreshReceivers() {
    $.ajax({
        type: "GET",
        url: receivers_url,
        data: "",
        dataType: "json",
        success: function(response, textStatus) {
            offline.set('receivers', response);
            updateReceivers(response);
        },
        error: function() {
            if(!ls_receivers && offline.get('opt_offline')) updateReceivers(offline.get('receivers'));
        },
        complete: function(request, textStatus) {
            periodical_listeners = setTimeout(refreshReceivers, 60 * 1000);
        }
    });
}

function refreshPredictions() {
    $.ajax({
        type: "GET",
        url: predictions_url,
        data: "",
        dataType: "json",
        success: function(response, textStatus) {
            offline.set('predictions', response);
            updatePredictions(response);
        },
        error: function() {
            if(!ls_pred && offline.get('opt_offline')) updatePredictions(offline.get('predictions'));
        },
        complete: function(request, textStatus) {
            periodical_predictions = setTimeout(refreshPredictions, 2 * timer_seconds * 1000);
        }
    });
}

var periodical, periodical_receivers, periodical_predictions;
var timer_seconds = 14;

function startAjax() {
    // prevent insane clicks to start numerous requests
    clearTimeout(periodical);
    clearTimeout(periodical_receivers);
    clearTimeout(periodical_predictions);

    // the periodical starts here, the * 1000 is because milliseconds required

    //periodical = setInterval(refresh, timer_seconds * 1000);
    refresh();

    //periodical_listeners = setInterval(refreshReceivers, 60 * 1000);
    refreshReceivers();

    //periodical_predictions = setInterval(refreshPredictions, 2 * timer_seconds * 1000);
    refreshPredictions();
}

function stopAjax() {
    // stop our timed ajax
    clearTimeout(periodical);
}

var currentPosition = null;

function updateCurrentPosition(lat, lon) {
    var latlng = new google.maps.LatLng(lat, lon);

    if(!currentPosition) {
        currentPosition = {marker: null, lat: lat, lon: lon};
        currentPosition.marker = new google.maps.Marker({
            icon: {
                url: "img/marker-you.png",
                size: new google.maps.Size(21,50),
                scaledSize: new google.maps.Size(21,50),
                anchor: new google.maps.Point(10,25)
            },
            zIndex: Z_CAR,
            position: latlng,
            map: map,
            optimized: false,
            title: "Your current position",
            animation: google.maps.Animation.DROP
        });
    } else {
      currentPosition.lat = lat;
      currentPosition.lon = lon;
      currentPosition.marker.setMap(map);
      currentPosition.marker.setPosition(latlng);
    }
}

function updateReceiverMarker(receiver) {
  var latlng = new google.maps.LatLng(receiver.lat, receiver.lon);
  if(!receiver.marker) {
    //icon.infoWindowAnchor = new google.maps.Point(13,3);
    receiver.marker = new google.maps.Marker({
        icon: {
            url: host_url + markers_url + "antenna-green.png",
            size: new google.maps.Size(26,32),
            scaledSize: new google.maps.Size(26,32),
            anchor: new google.maps.Point(13,30),
        },
        zIndex: Z_STATION,
        position: latlng,
        map: map,
        optimized: false,
        title: receiver.name,
        animation: google.maps.Animation.DROP
    });
  } else {
    receiver.marker.setPosition(latlng);
  }
}

function updateReceivers(r) {
    if(!r) return;
    ls_receivers = true;

    for(var i = 0, ii = r.length; i < ii; i++) {
        var lat = parseFloat(r[i].lat);
        var lon = parseFloat(r[i].lon);
        if(lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
        var r_index = $.inArray(r[i].name, receiver_names);
        var receiver = null;
        if(r_index == -1) {
            receiver_names.push(r[i].name);
            r_index = receiver_names.length - 1;
            receivers[r_index] = {marker: null};
        }
        receiver = receivers[r_index];
        receiver.name = r[i].name;
        receiver.lat = lat;
        receiver.lon = lon;
        receiver.alt = parseFloat(r[i].alt);
        receiver.description = r[i].description;
        updateReceiverMarker(receiver);
        }
    }

function updatePredictions(r) {
    if(!r) return;
    ls_pred = true;

    for(var i = 0, ii = r.length; i < ii; i++) {
		var vehicle_index = $.inArray(r[i].vehicle, vehicle_names);
		if(vehicle_index != -1) {
			if(vehicles[vehicle_index].prediction && vehicles[vehicle_index].prediction.time == r[i].time) {
				continue;
			}
            vehicles[vehicle_index].prediction = r[i];
            if(parseInt(vehicles[vehicle_index].prediction.landed) == 0) {
                vehicles[vehicle_index].prediction.data = $.parseJSON(r[i].data);
                redrawPrediction(vehicle_index);
            } else {
                removePrediction(vehicle_index);
            }
	    }
	}
}

function refreshUI() {
    for (var i = 0, ii = vehicle_names.length; i < ii; i++) {
        updateVehicleInfo(i, vehicles[i].curr_position);
    }
}

var status = "";
var bs_idx = 0;

function update(response) {
  if (response == null || !response.positions) {
    return;
  }

  var updated_position = false;
  for (var i = 0; i < response.positions.position.length; i++) {
    var position = response.positions.position[i];
    if (!position.picture) {
      addPosition(position);
      got_positions = true;
      updated_position = true;
    }
  }

  if (response.positions.position.length > 0) {
    var position = response.positions.position[response.positions.position.length-1];
    position_id = position.position_id;
  }

  if (updated_position) {
      // create a dummy response object for postions
      var lastPositions = { positions: { position: [] } };
      var lastPPointer = lastPositions.positions.position;

      for (var i = 0, ii = vehicle_names.length; i < ii; i++) {
        if(!bootstrapped) {
            setTimeout(function() {
                var idx = bs_idx;
                bs_idx += 1;
                updatePolyline(idx);
                updateVehicleInfo(idx, vehicles[idx].curr_position);

                if(listScroll) listScroll.refresh();

                // update the altitude profile, only if its a balloon
                if(vehicles[idx].vehicle_type != "car") {
                    var graph_src = graph_url.replace("{AA}",vehicles[idx].alt_max); // top range, buttom is always 0
                    graph_src += GChartEncodeData(vehicles[idx].alt_list, vehicles[idx].alt_max); // encode datapoint to preserve bandwith

                    // update img element
                    $('.vehicle'+idx+' .graph').attr('src', graph_src);
                }
            }, 400*i);
        } else {
            updatePolyline(i);
            updateVehicleInfo(i, vehicles[i].curr_position);

            // update the altitude profile, only if its a balloon
            if(vehicles[i].vehicle_type != "car") {
                var graph_src = graph_url.replace("{AA}",vehicles[i].alt_max); // top range, buttom is always 0
                graph_src += GChartEncodeData(vehicles[i].alt_list, vehicles[i].alt_max); // encode datapoint to preserve bandwith

                // update img element
                $('.vehicle'+i+' .graph').attr('src', graph_src);
            }

            // remember last position for each vehicle
            lastPPointer.push(vehicles[i].curr_position);
        }
	  }

      bootstrapped = true;

      // update graph is current vehicles is followed
      if(follow_vehicle != -1 && vehicles[follow_vehicle].graph_data_updated) updateGraph(follow_vehicle, false);

      // store in localStorage
      offline.set('positions', lastPositions);

	  if(follow_vehicle != -1) {
	  	var pos = vehicles[follow_vehicle].curr_position;
	  	map.panTo(new google.maps.LatLng(pos.gps_lat, pos.gps_lon));
	  }
  }

  if (got_positions && !zoomed_in) {
    if(vehicles.length == 0) return;

    zoom_timer = setInterval(function() {
        if(bootstrapped && bs_idx+1 == vehicle_names.length) {
            zoom_on_payload();
            clearInterval(zoom_timer);
        }
    },100);

    zoomed_in = true;
  }

  if(listScroll) listScroll.refresh();
}

function zoom_on_payload() {
    // find a the first balloon
    var i = -1, ii = vehicles.length;
    while(++i < ii && !vehicles[i].marker_shadow);

    if(i == ii) { i = 0 }
    else {
        // find the bounds of the ballons first and last positions
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(vehicles[i].positions[0]);
        bounds.extend(vehicles[i].marker.getPosition());

        // fit the map to those bounds
        map.fitBounds(bounds);

        // limit the zoom level to 11
        if(map.getZoom() > 11) map.setZoom(11);
    }

    // pan and follow the vehicle
    followVehicle(i);

    // expand list element
    $('.vehicle'+i).addClass('active');

    // scroll list to the expanded element
    listScroll.refresh();
    listScroll.scrollToElement('.portrait .vehicle'+i);
}

function isInt(n) {
   return n % 1 === 0;
}
