var mission_id = 0;
var position_id = 0;
var data_url = "http://spacenear.us/tracker/data.php?vehicles=";
var receivers_url = "http://spacenear.us/tracker/receivers.php";
var predictions_url = "http://spacenear.us/tracker/get_predictions.php";
var host_url = "";
var markers_url = "img/markers/";
var vehicle_names = [];
var vehicles = [];

var receiver_names = [];
var receivers = [];  

var num_updates = 0;
var got_positions = false;
var zoomed_in = false;
var expanded_onload = false;
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
var Z_PATH = 3;
var Z_SHADOW = 4;
var Z_CAR = 5;
var Z_PAYLOAD = 6;

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
        zoomContro: true,
        scrollwheel: true
    });
    
    nite.init(map);
    nite.hide();
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
	if(follow_vehicle != -1) vehicles[follow_vehicle].follow = false;
	
	if(follow_vehicle == index) {
        vehicles[follow_vehicle].follow = false;
        follow_vehicle = -1;
    } else if(follow_vehicle != index) {
		follow_vehicle = index;
		vehicles[follow_vehicle].follow = true;
        panTo(index);
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
              vehicle_names[vehicle_index] == "wb8elk2") {
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
    var active = '';
    if(!expanded_onload && vehicles[index].vehicle_type == "balloon") {
        active = 'active';
        expanded_onload = true;    
    }
    $('.portrait').append('<div class="row '+active+' vehicle'+index+'"></div>');
    $('.landscape').append('<div class="row '+active+' vehicle'+index+'"></div>');

  }

  var ascent_text = position.gps_alt != 0 ? vehicles[index].ascent_rate.toFixed(1) + ' m/s' : '';
  
  var coords_text;
  var ua =  navigator.userAgent.toLowerCase();
  // determine how to link the vehicle coordinates to a native app, if on a mobile device
  if(ua.indexOf('iphone') > -1) { 
      coords_text = '<a id="launch_mapapp" href="http://maps.google.com/?q='+position.gps_lat+','+position.gps_lon+'">'
                    + roundNumber(position.gps_lat, 6) + ', ' + roundNumber(position.gps_lon, 6) +'</a>'
                    + ' <i class="icon-location"></i>';
  } else if(ua.indexOf('android') > -1) { 
      coords_text = '<a id="launch_mapapp" href="geo:0,0?q='+position.gps_lat+','+position.gps_lon+'">'
                    + roundNumber(position.gps_lat, 6) + ', ' + roundNumber(position.gps_lon, 6) +'</a>'
                    + ' <i class="icon-location"></i>';
  } else {
      coords_text = roundNumber(position.gps_lat, 6) + ', ' + roundNumber(position.gps_lon, 6);
  }
  // start
  var a    = '<div class="header"><span>' + vehicle_names[index] + '</span><i class="arrow"></i></div>'
           + '<div class="data">'
           + '<img src="'+image+'" />'
           + '<div class="left">'
           + '<dl>';
  // end
  var b    = '</dl>'
           + '</div>' // right
           + '</div>' // data
           + '';
  var c    = '<dt class="recievers">Recieved by:</dt><dd class="recievers">'
           + position.callsign.split(",").join(", ") + '</dd>'

  if(!position.callsign) c = '';

  // mid for portrait
  var p    = '<dt>'+position.gps_time+'</dt><dd>time</dd>'
           + '<dt>'+coords_text+'</dt><dd>coordinates</dd>'
           + c // recievers if any
           + '</dl>'
           + '</div>' // left
           + '<div class="right">'
           + '<dl>'
           + '<dt>'+ascent_text+'</dt><dd>rate</dd>'
           + '<dt>'+position.gps_alt+' m</dt><dd>altitude</dd>'
           + '<dt>'+vehicles[index].max_alt+' m</dt><dd>max alt</dd>'
           + '';
  // mid for landscape
  var l    = '<dt>'+ascent_text+'</dt><dd>rate</dd>'
           + '<dt>'+position.gps_alt+'m ('+vehicles[index].max_alt+'m)</dt><dd>altitude (max)</dd>'
           + '<dt>'+position.gps_time+'</dt><dd>time</dd>'
           + '<dt>'+coords_text+'</dt><dd>coordinates</dd>'
           + habitat_data(position.data) 
           + c // recievers if any
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
        zIndex: Z_SHADOW,
        icon: new google.maps.MarkerImage(
                    icon,
                    null,
                    null,
                    new google.maps.Point(15,15)
        ),
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
    for(var i = 0, ii = data.length; i <ii; i++) {
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
		
    if(vehicle_names[vehicle_index] != "wb8elk2") { // WhiteStar
        var image_src = host_url + markers_url + "target-" + balloon_colors_name[vehicles[vehicle_index].color_index] + ".png";
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
        if(typeof vehicle.prediction_target !== 'undefined') {
            vehicle.prediction_target.setPosition(latlng);
        } else {
            vehicle.prediction_target = addMarker(image_src, latlng);
        }
    } else {
        if(vehicle.prediction_target) vehicle.prediction_target = null;
    }
  
    if(burst_index != 0 && vehicle_names[vehicle_index] != "wb8elk2") {
        var icon = host_url + markers_url + "balloon-pop.png";
        /*
        //icon.infoWindowAnchor = new google.maps.Point(18,5);
        
        var time = new Date(data[burst_index].time * 1000);
        var time_string = pad(time.getUTCHours(), 2) + ':' + pad(time.getUTCMinutes(), 2) + ' UTC';
        var html = '<b>Predicted Burst</b><br />'
                         + '<p style="font-size: 10pt;">'
                         + data[burst_index].lat + ', ' + data[burst_index].lon + ', ' + Math.round(data[burst_index].alt) + ' m at ' + time_string
                         + '</p>';
        */
        if(typeof vehicle.prediction_burst !== 'undefined') {
            vehicle.prediction_burst.setPosition(latlng);
        } else {
            vehicle.prediction_burst = addMarker(image_src, latlng);
        }
    } else {
        if(vehicle.prediction_burst) vehicle.prediction_burst = null;
    }
}

function updatePolyline(vehicle_index) {
    vehicles[vehicle_index].polyline.setPath(vehicles[vehicle_index].positions);
}

function convert_time(gps_time) {
  // example: "2009-05-28 20:29:47"
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
  
  return date.getTime() / 1000; // seconds since 1/1/1970 @ 12:00 AM
}

function addPosition(position) { 
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
                icon: image_src,
                zIndex: Z_CAR,
                position: point,
                map: map
            });
        } else {
            vehicle_type = "balloon";
            color_index = balloon_index++;
            var c = color_index % balloon_colors.length;
            
            image_src = host_url + markers_url + "balloon-" + balloon_colors_name[c] + ".png";
            marker_shadow = new google.maps.Marker({
                map: map,
                zIndex: Z_SHADOW,
                position: point,
                icon: new google.maps.MarkerImage(
                    host_url + markers_url + "shadow.png",
                    new google.maps.Size(24,16),
                    null,
                    new google.maps.Point(12,8)
                ),
                clickable: false
            });
            marker = new google.maps.Marker({
                map: map,
                zIndex: Z_PAYLOAD,
                position: point,
                icon: image_src,
                title: position.vehicle,
            });
            marker.shadow = marker_shadow;
            marker.balloonColor = balloon_colors_name[c];
            marker.mode = 'balloon';
            marker.setMode = function(mode) {
                this.mode = mode;
                var img;
                if(mode == "landed") {
                    img = host_url + markers_url + "payload-" + this.balloonColor + ".png";
                    img = new google.maps.MarkerImage(img, null, null, new google.maps.Point(8, 15));
                } else if(mode == "parachute") {
                    img = host_url + markers_url + "parachute-" + this.balloonColor + ".png";
                } else {
                    img = host_url + markers_url + "balloon-" + this.balloonColor + ".png";
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
                fillOpacity: 0.05,
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
                fillOpacity: 0.05,
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
                            polyline: new google.maps.Polyline({
                                map: map,
                                zIndex: Z_PATH,
                                strokeColor: balloon_colors[c],
                                strokeOpacity: 0.8,
                                strokeWeight: 3,
                                clickable: false,
                                draggable: false,
                            }),
                            prediction: null,
                            ascent_rate: 0.0,
                            max_alt: parseFloat(position.gps_alt),
                            alt_data: new Array(),
                            path_enabled: vehicle_type == "balloon" && position.vehicle.toLowerCase().indexOf("iss") == -1,
                            follow: false,
                            color_index: c};
        vehicles.push(vehicle_info);
    }

    var vehicle_index = $.inArray(position.vehicle, vehicle_names);
    var vehicle = vehicles[vehicle_index];

    if(vehicle.vehicle_type == "balloon") {
        var new_latlng = new google.maps.LatLng(position.gps_lat, position.gps_lon);
        
        // if position array has at least 1 position
        if(vehicle.num_positions > 0) {
            if((new Date(vehicle.curr_position.gps_time)).getTime() >= (new Date(position.gps_time)).getTime()) {
            //if(vehicle.curr_position.gps_lat == position.gps_lat
             //  && vehicle.curr_position.gps_lon == position.gps_lon) {
                if (("," + vehicle.curr_position.callsign + ",").indexOf("," + position.callsign + ",") === -1) {
                  vehicle.curr_position.callsign += "," + position.callsign;
                }
            } else {

                dt = convert_time(position.gps_time)
                   - convert_time(vehicle.curr_position.gps_time);

                if(dt != 0) {
                    rate = (position.gps_alt - vehicle.curr_position.gps_alt) / dt;
                    vehicle.ascent_rate = 0.7 * rate
                                          + 0.3 * vehicles[vehicle_index].ascent_rate;
                }

                if(vehicle.curr_position.gps_lat != position.gps_lat
                   || vehicle.curr_position.gps_lon != position.gps_lon) {
                    // add the new position
                    vehicle.positions.push(new_latlng);
                    vehicle.num_positions++;

                    vehicle.curr_position = position;
                }
            }
        } else {
            vehicle.positions.push(new_latlng);
            vehicle.num_positions++;
            vehicle.curr_position = position;
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

function refresh() {
  //status = '<img src="spinner.gif" width="16" height="16" alt="" /> Refreshing ...';
  //$('#status_bar').html(status);

  $.ajax({
    type: "GET",
    url: data_url,
    data: "format=json&position_id=" + position_id + "&max_positions=" + max_positions,
    dataType: "json",
    success: function(response, textStatus) {
                update(response);
                //$('#status_bar').html(status);
             },
    complete: function(request, textStatus) {
                // remove the spinner
                //$('status_bar').removeClass('ajax_loading');
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
                    updateReceivers(response);
                 },
        complete: function(request, textStatus) {
                    // remove the spinner
                    //$('status_bar').removeClass('ajax_loading');
                    //$('#status_bar').html(status);
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
                    updatePredictions(response);
                 },
        complete: function(request, textStatus) {
                    // remove the spinner
                    //$('status_bar').removeClass('ajax_loading');
                    //$('#status_bar').html(status);
                    periodical_predictions = setTimeout(refreshPredictions, 2 * timer_seconds * 1000);
               }
    });
}

var periodical, periodical_receivers, periodical_predictions;
var timer_seconds = 30;

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
            icon: "img/marker-you.png",
            zIndex: Z_CAR,
            position: latlng,
            size:  new google.maps.Size(19,40),
            anchor: new google.maps.Point(9,40),
            map: map,
            title: "Your current position",
            animation: google.maps.Animation.DROP
        });
    } else {
      currentPosition.lat = lat;
      currentPosition.lon = lon;
      currentPosition.marker.setPosition(latlng);
    }
}

function updateReceiverMarker(receiver) {
  var latlng = new google.maps.LatLng(receiver.lat, receiver.lon);
  if(!receiver.marker) {
    //icon.infoWindowAnchor = new google.maps.Point(13,3);
    receiver.marker = new google.maps.Marker({
        icon:  host_url + markers_url + "antenna-green.png",
        zIndex: Z_STATION,
        position: latlng,
        size: new google.maps.Size(26,32),
        anchor: new google.maps.Point(13,30),
        map: map,
        title: receiver.name,
        animation: google.maps.Animation.DROP
    });
  } else {
    receiver.marker.setPosition(latlng);
  }
}

function updateReceivers(r) {
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
    for(var i = 0, ii = r.length; i < ii; i++) {
		var vehicle_index = $.inArray(r[i].vehicle, vehicle_names);
		if(vehicle_index != -1) {
			if(vehicles[vehicle_index].prediction && vehicles[vehicle_index].prediction.time == r[i].time) {
				continue;
			}
            vehicles[vehicle_index].prediction = r[i];
            if(parseInt(vehicles[vehicle_index].prediction.landed) == 0) {
                vehicles[vehicle_index].prediction.data = eval('(' + r[i].data + ')');
                redrawPrediction(vehicle_index);
            } else {
                removePrediction(vehicle_index); 
            }
	    }
	}
}

var status = "";

function update(response) {
  if (response == null || !response.positions) {
    return;
  }
  
  var updated_position = false;
  for (i = 0; i < response.positions.position.length; i++) {
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
	  for (vehicle_index = 0; vehicle_index < vehicle_names.length; vehicle_index++) {
	  	updatePolyline(vehicle_index);
	    updateVehicleInfo(vehicle_index, vehicles[vehicle_index].curr_position);
	  }
	  if(follow_vehicle != -1) {
	  	var pos = vehicles[follow_vehicle].curr_position;
	  	map.panTo(new google.maps.LatLng(pos.gps_lat, pos.gps_lon));
	  }
  }
  
  if (got_positions && !zoomed_in) {
    // find a the first balloon
    var i = 0;    
    while(!vehicles[i].marker_shadow) i++;

    // find the bounds of the ballons first and last positions
    var bounds = new google.maps.LatLngBounds();
    bounds.extend(vehicles[i].marker.getPosition());
    bounds.extend(vehicles[i].positions[0]);
    
    // fit the map to those bounds
    map.fitBounds(bounds);

    // limit the zoom level to 11
    if(map.getZoom() > 11) map.setZoom(11);

    // pan and follow that balloon
    followVehicle(i);

    // scroll list to the expanded element
    listScroll.refresh();
    listScroll.scrollToElement('.portrait .vehicle'+i);

    zoomed_in = true;
  }
  
  if(listScroll) listScroll.refresh();
}
