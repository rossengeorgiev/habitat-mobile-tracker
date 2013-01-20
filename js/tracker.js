var mission_id = 0;
var position_id = 0;
var data_url = "http://spacenear.us/tracker/data.php?vehicles=";
var receivers_url = "http://spacenear.us/tracker/receivers.php";
var predictions_url = "http://spacenear.us/tracker/get_predictions.php";
var host_url = "http://spacenear.us/tracker/";
var vehicle_names = [];
var vehicles = [];

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
var balloon_colors = ["red", "blue", "green", "yellow"];

var color_table = new Array("#aa0000", "#0000ff", "#006633", "#ff6600", "#003366", "#CC3333","#663366" ,"#000000");

var map = null;
//var polylineEncoder = new PolylineEncoder();

var notamOverlay = null;

// preload images
//img_spinner = new Image(100,25); 
//img_spinner.src = "spinner.gif"; 

function load() {

  var map = new google.maps.Map(document.getElementById('map'), {
      zoom: 2,
      center: new google.maps.LatLng(0, 0),
      mapTypeId: google.maps.MapTypeId.ROADMAP
  });

  if (1==2) {
    //----- Stop page scrolling if wheel over map ----
    GEvent.addDomListener(mapDiv, "DOMMouseScroll", wheelevent);
    mapDiv.onmousewheel = wheelevent;
		
    GEvent.addListener(map, 'zoomend',
    										function() {
    											map.closeInfoWindow();
										  		if(window_selector) {
														map.removeOverlay(window_selector);
														window_selector = null;
													}
                          updateZoom();
    										});
    
    GEvent.addListener(map, 'mousemove', function(latlng) { mouseMove(latlng); });
    GEvent.addListener(map, 'click', function(overlay, latlng, overlaylatlng) { mouseClick(latlng ? latlng : (overlay != map.getInfoWindow() ? overlaylatlng : null)); });
		GEvent.addListener(map, 'infowindowclose', function(latlng) { infoWindowCloseEvent(); });

  }

  startAjax();
}

function unload() {
  google.maps.Unload();
}

//----- Stop page scrolling if wheel over map ----
function wheelevent(e) {
    if (!e) e = window.event;
    if (e.preventDefault) e.preventDefault();
    e.returnValue = false;
}

var num_pics = 0;

function insertPicture(thumb_url, pic_url, text, title) {
  var table_pics = $('#picture_table_pics');
  table_pics.append('<td colspan="2" style="text-align: center;"><a href="' + pic_url + '" rel="lightbox[pics]" title="' + title + '"><img src="' + thumb_url + '" /></a></td>');
  var table_txts = $('#picture_table_txts');
  table_txts.append('<td style="border-right: 0; font-size: 15px; font-weight:bold; color: gray;" width="32">' + (num_pics+1) + '</td>');
  table_txts.append('<td align=left>' + text + '</td>');
  
  num_pics++;

  // update slimbox
  if (!/android|iphone|ipod|series60|symbian|windows ce|blackberry/i.test(navigator.userAgent)) {
    jQuery(function($) {
      $("a[rel^='lightbox']").slimbox({/* Put custom options here */}, null, function(el) {
        return (this == el) || ((this.rel.length > 8) && (this.rel == el.rel));
      });
    });
  }

  //$('#scroll_pane').animate({scrollLeft: '' + $('#scroll_pane').width() + 'px'}, 1000);
}

function addPicture(vehicle, gps_time, gps_lat, gps_lon, gps_alt, gps_heading, gps_speed, picture) {
  insertPicture("pics/thumb-" + picture, "pics/" + picture, "<b>Time:</b> " + gps_time.split(" ")[1] + "<br /><b>Altitude:</b> " + gps_alt + " m<br />", "Altitude: " + gps_alt + " m");
}

function panTo(vehicle_index) {
  map.panTo(new google.maps.LatLng(vehicles[vehicle_index].curr_position.gps_lat, vehicles[vehicle_index].curr_position.gps_lon));
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

    var data = eval("(" + jsondata + ")");
    var output = [];

    for (var key in data) {
      if (hide_keys[key] === true)
        continue;

      var name = "", suffix = "";
      if (keys[key] !== undefined)
        name = keys[key];
      else
        name = guess_name(key);

      if (suffixes[key] !== undefined)
        suffix = " " + suffixes[key];

      output.push("<dt>" + data[key] + suffix + "</dt><dd>" + name + "</dd>");
    }

    output.sort();
    return output.join(" ");
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

function togglePath(index) {
	vehicles[index].path_enabled = !vehicles[index].path_enabled;
	if(vehicles[index].path_enabled) {
		$('#btn_path_' + index).addClass('vehicle_button_enabled');
	} else {
		$('#btn_path_' + index).removeClass('vehicle_button_enabled');
	}
	updatePolyline(index);
}

function followVehicle(index) {
	if(follow_vehicle != -1) {
		vehicles[follow_vehicle].follow = false;
		$('#btn_follow_' + follow_vehicle).removeClass('vehicle_button_enabled');
	}
	
	if(follow_vehicle == index) {
		follow_vehicle = -1;
	} else {
		follow_vehicle = index;
		vehicles[follow_vehicle].follow = true;
		$('#btn_follow_' + follow_vehicle).addClass('vehicle_button_enabled');
	}
}

function vehicleButtons(index) {
    return;

	var html = '<div class="vehicle_buttons">'
	         +    '<span class="vehicle_button" onclick="panTo(' + index + ')">Pan To</span>'
					 + ' | <span id="btn_path_' + index + '" class="vehicle_button' + (vehicles[index].path_enabled ? ' vehicle_button_enabled' : '') + '" onclick="togglePath(' + index + ')">Path</span>'
					 + ' | <span id="btn_follow_' + index + '" class="vehicle_button' + (vehicles[index].follow ? ' vehicle_button_enabled' : '') + '" onclick="followVehicle(' + index + ')">Follow</span>'
					 + '</div>';
	return html;
}

function roundNumber(number, digits) {
  var multiple = Math.pow(10, digits);
  var rndedNum = Math.round(number * multiple) / multiple;
  return rndedNum;
}

function updateVehicleInfo(index, position) {
  var latlng = new google.maps.LatLng(position.gps_lat, position.gps_lon);
  vehicles[index].marker.setLatLng(latlng);
  if(vehicles[index].vehicle_type == "balloon") {
    updateAltitude(index);
    var horizon_km = Math.sqrt(12.756 * position.gps_alt);
    vehicles[index].horizon_circle.setRadiusKm(Math.round(horizon_km));     
    vehicles[index].horizon_circle.setPoint(latlng);

    if(vehicles[index].subhorizon_circle) {
      // see: http://ukhas.org.uk/communication:lineofsight
      var el = 5.0; // elevation above horizon
      var rad = 6378.10; // radius of earth
      var h = position.gps_alt / 1000; // height above ground
      
      var elva = el * Math.PI / 180.0;
      var slant = rad*(Math.cos(Math.PI/2+elva)+Math.sqrt(Math.pow(Math.cos(Math.PI/2+elva),2)+h*(2*rad+h)/Math.pow(rad,2)));
      var x = Math.acos((Math.pow(rad,2)+Math.pow(rad+h,2)-Math.pow(slant,2))/(2*rad*(rad+h)))*rad;
   
      var subhorizon_km = x;
      vehicles[index].subhorizon_circle.setRadiusKm(Math.round(subhorizon_km));
      vehicles[index].subhorizon_circle.setPoint(latlng);
    }

    var landed =  vehicles[index].max_alt > 1000
               && vehicles[index].ascent_rate < 1.0
               && position.gps_alt < 300;

    if(landed) {
      vehicles[index].marker.setMode("landed");
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

  //var container = $('vehicle' + index);
  var elm = $('.vehicle' + index);
  if (elm.length == 0) {
    var active = (index == 0) ? 'active' : '';
    $('.portrait').append('<div class="row '+active+' vehicle'+index+'"></div>');
    $('.landscape').append('<div class="row '+active+' vehicle'+index+'"></div>');
    
  }

  var ascent_text = position.gps_alt != 0 ? vehicles[index].ascent_rate.toFixed(1) + ' m/s' : '';
  
  var coords_text;
  var ua =  navigator.userAgent.toLowerCase();
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

function showSignals(index, position) {
  if(!position) return;
  if(signals_seq == position.sequence) return;
  hideSignals();
  signals_seq = position.sequence;
  signals = [];
  if(position.callsign == "") return;
  var callsigns = position.callsign.split(",");
  for(var i = 0, ii = callsigns.length; i < ii; i++) {
  	// check receivers first:
    var r_index = $.inArray(callsigns[i], receiver_names);
    if(r_index != -1) {
      var receiver = receivers[r_index];
      var latlngs = [];
      latlngs.push(new google.maps.LatLng(position.gps_lat, position.gps_lon));
      latlngs.push(new google.maps.LatLng(receiver.lat, receiver.lon));
      var poly = new GPolyline(latlngs, "#00FF00", 2, 0.5);
      signals.push(poly);
      map.addOverlay(poly);
    } else {
    	// if nothing found, check vehicles:
    	var vehicle_index;
    	var r = new RegExp(callsigns[i], "i"); // check if callsign is contained in vehicle name
    	for(vehicle_index = 0, iii = vehicle_names.length; vehicle_index < iii; vehicle_index++) {
    		if(vehicle_names[vehicle_index].search(r) != -1) break;
    	}
    	if(vehicle_index != vehicle_names.length
         && vehicle_names[vehicle_index].toLowerCase() != callsigns[i].toLowerCase()) {
	      var vehicle_pos = vehicles[vehicle_index].curr_position;
	      var latlngs = [];
	      latlngs.push(new google.maps.LatLng(position.gps_lat, position.gps_lon));
	      latlngs.push(new google.maps.LatLng(vehicle_pos.gps_lat, vehicle_pos.gps_lon));
	      var poly = new GPolyline(latlngs, "#00FF00", 2, 0.5);
	      signals.push(poly);
	      map.addOverlay(poly);
      }
    }
  }
}

function hideSignals() {
  if(!signals) return;
  for(var i = 0, ii = signals.length; i <<i; i++) {
    map.removeOverlay(signals[i]);
  }
  signals = null;
  signals_seq = -1;
}

function showSelector(latlng, color) {
  if(!selector) {
    selector = new Selector(latlng, {color: color});
    map.addOverlay(selector);
  } else {
  	selector.setLatLng(latlng);
  	selector.setColor(color);
  }
}

function hideSelector() {
	if(selector) {
	  map.removeOverlay(selector);
	  selector = null;
  }
}

function mouseVehiclePos(latlng) {
    return;
	if(!latlng) {
		return null;
	}
	var vehicle_index = -1, pos, best_dist = 9999999999;
	var p1 = map.fromLatLngToDivPixel(latlng);
	for(var v = 0, vv = vehicles.length; v < vv; v++) {
		if(!vehicles[v].path_enabled) {
			continue;
		}
		for(var i = 0, ii =vehicles[v].line.length; i < ii; i++) { // note: skip the last pos
			var p2 = map.fromLatLngToDivPixel(vehicles[v].line[i]);
			var dist = Math.sqrt(Math.pow(p2.x-p1.x, 2) + Math.pow(p2.y-p1.y,2));
			if(dist < best_dist) {
				best_dist = dist;
				vehicle_index = v;
				pos = i;
			}
		}
	}
	
	if(vehicle_index != -1 && best_dist < 16) {
		return {vehicle_index: vehicle_index, pos: pos};
	} else {
		return null;
	}
}

function mouseMove(latlng) {
	var result = mouseVehiclePos(latlng);
	
	if(result) {
    if(result.pos < vehicles[result.vehicle_index].line.length-1) { // do not show marker for current pos
		  showSelector(vehicles[result.vehicle_index].line[result.pos], color_table[result.vehicle_index]);
		  selector.setHtml(getInfoHtml(result.vehicle_index, vehicles[result.vehicle_index].positions[result.pos]));
    } else {
      hideSelector();
    }
    showSignals(result.vehicle_index, vehicles[result.vehicle_index].positions[result.pos]);
	} else {
		hideSelector();
    hideSignals();
	}
}

function mouseClick(latlng) {
	if(selector) {
		if(window_selector) {
			map.removeOverlay(window_selector);
			window_selector = null;
		}
		window_selector = selector.copy();
		map.addOverlay(window_selector);
		window_selector.openInfoWindow();
	}
}

function infoWindowCloseEvent() {
	if(!selector && window_selector) {
		map.removeOverlay(window_selector);
		window_selector = null;
	}
}

function pad(number, length) {
  var str = '' + number;
  while (str.length < length) {
      str = '0' + str;
  }
  return str;
}

function addMarker(icon, latlng, html) {
	var marker = new GMarker(latlng, {icon: icon});
  map.addOverlay(marker);
  
  GEvent.addListener(marker, "click", function() {
    marker.openInfoWindowHtml(html);
  });
  
  return marker;
}

function removePrediction(vehicle_index) {
  if(vehicles[vehicle_index].prediction_polyline) {
    map.removeOverlay(vehicles[vehicle_index].prediction_polyline);
    vehicles[vehicle_index].prediction_polyline = null;
  }
  if(vehicles[vehicle_index].prediction_target) {
    map.removeOverlay(vehicles[vehicle_index].prediction_target);
    vehicles[vehicle_index].prediction_target = null;
  }
  if(vehicles[vehicle_index].prediction_burst) {
    map.removeOverlay(vehicles[vehicle_index].prediction_burst);
    vehicles[vehicle_index].prediction_burst = null;
  }
}

function redrawPrediction(vehicle_index) {
	var data = vehicles[vehicle_index].prediction.data;
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
		//var polyline = polylineEncoder.dpEncodeToGPolyline(line, color_table[vehicle_index], 2, 0.3);
		removePrediction(vehicle_index);
  map.addOverlay(polyline);
		
		if(vehicle_names[vehicle_index] != "wb8elk2") { // WhiteStar
	  var image_src = host_url + "images/markers/target-" + balloon_colors[vehicles[vehicle_index].color_index] + ".png";
	  var icon = new google.maps.Icon();
	  icon.image = image_src;
	  icon.iconSize = new GSize(25,25);
	  icon.iconAnchor = new GPoint(13,13);
	  icon.infoWindowAnchor = new GPoint(13,5);
	  
	  var time = new Date(data[data.length-1].time * 1000);
	  var time_string = pad(time.getUTCHours(), 2) + ':' + pad(time.getUTCMinutes(), 2) + ' UTC';
	  var html = '<b>Predicted Landing</b><br />'
	  				 + '<p style="font-size: 10pt;">'
	  				 + data[data.length-1].lat + ', ' + data[data.length-1].lon + ' at ' + time_string
	  				 + '</p>';
	  vehicles[vehicle_index].prediction_target = addMarker(icon, latlng, html);
  } else {
    vehicles[vehicle_index].prediction_target = null;
  }
  
		if(burst_index != 0 && vehicle_names[vehicle_index] != "wb8elk2") {
	  var image_src = host_url + "images/markers/balloon-pop.png";
	  var icon = new google.maps.Icon();
	  icon.image = image_src;
	  icon.iconSize = new GSize(35,32);
	  icon.iconAnchor = new GPoint(18,15);
	  icon.infoWindowAnchor = new GPoint(18,5);
	  
	  var time = new Date(data[burst_index].time * 1000);
	  var time_string = pad(time.getUTCHours(), 2) + ':' + pad(time.getUTCMinutes(), 2) + ' UTC';
	  var html = '<b>Predicted Burst</b><br />'
	  				 + '<p style="font-size: 10pt;">'
	  				 + data[burst_index].lat + ', ' + data[burst_index].lon + ', ' + Math.round(data[burst_index].alt) + ' m at ' + time_string
	  				 + '</p>';
	  vehicles[vehicle_index].prediction_burst = addMarker(icon, latlng_burst, html);
  } else {
  	vehicles[vehicle_index].prediction_burst = null;
  }
		
		vehicles[vehicle_index].prediction_polyline = polyline;
}

function updatePolyline(vehicle_index) {
  if (got_positions && vehicles[vehicle_index].line.length > 1) {
    if (vehicles[vehicle_index].polyline) {
      map.removeOverlay(vehicles[vehicle_index].polyline);
    }
    //vehicles[vehicle_index].polyline = polylineEncoder.dpEncodeToGPolyline(vehicles[vehicle_index].line, color_table[vehicle_index]);

    if(vehicles[vehicle_index].path_enabled) {
    	map.addOverlay(vehicles[vehicle_index].polyline);
    }
  }
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

function findPosition(positions, other) {
  var sequence = other.sequence;
	if (!sequence || sequence == '' || sequence == 0) {
		return -1;
	}
	for(var i = 0, ii = positions.length; i < ii; i++) {
		if(positions[i].sequence != sequence) continue;
		if(positions[i].gps_lat != other.gps_lat) continue;
		if(positions[i].gps_lon != other.gps_lon) continue;
		if(positions[i].gps_time != other.gps_time) continue;
    return i;
	}
	return -1;
}

  

function insertPosition(vehicle, position) {
  var i = vehicle.positions.length;
  while(i--) {
    if(i >= 0 && convert_time(vehicle.positions[i].server_time) < convert_time(position.server_time)) {
      break;
    }
  }
  vehicle.positions.splice(i+1, 0, position);
  // add the point to form new lines
  vehicle.line.splice(i+1, 0, new google.maps.LatLng(position.gps_lat, position.gps_lon));
    var curr_time = convert_time(position.server_time)*1000;
    vehicle.alt_data.splice(i+1, 0, new Array(curr_time, position.gps_alt));
  return vehicle.positions[vehicle.positions.length-1];
}

function addPosition(position) { 
  // vehicle info
  //vehicle_names.include(position.vehicle);

  position.sequence = position.sequence ? parseInt(position.sequence, 10) : null;
  
  if($.inArray(position.vehicle, vehicle_names) == -1) {
    vehicle_names.push(position.vehicle);
    var marker = null;
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
      var image_src = host_url + "images/markers/car-" + car_colors[c] + ".png";
      var icon = new google.maps.Icon();
      icon.image = image_src;
      icon.iconSize = new GSize(55,25);
      icon.iconAnchor = new GPoint(27,22);
      icon.infoWindowAnchor = new GPoint(27,5);
      marker = new GMarker(point, {icon: icon});
    } else {
      vehicle_type = "balloon";
      color_index = balloon_index++;
      var c = color_index % balloon_colors.length;
      
      if(position.vehicle.toLowerCase().indexOf("iss") != -1) {
        image_src = "icons/iss.png";
        marker = new BalloonMarker(point, {color: "iss", width: 50, height: 38});
      } else if (position.vehicle.toLowerCase() == "osiris" || position.vehicle.toLowerCase() == "petunia") {
        /* XXX OSIRIS INVISIBLE */
        image_src = host_url + "images/markers/balloon-invisible.png";
        marker = new BalloonMarker(point, {color: "invisible"});
      } else {
        image_src = host_url + "images/markers/balloon-" + balloon_colors[c] + ".png";
        marker = new BalloonMarker(point, {color: balloon_colors[c]});
      }      

      var circle_radius_km = 1;
      //horizon_circle = new CircleOverlay(point, circle_radius_km, "#336699", 1, 1, '#336699', 0.0);
      /*
      horizon_circle = new BDCCCircle(point,
                                      circle_radius_km, // radius in km
                                      "#0000FF",        // stroke color
                                      3,                // stroke weight
                                      0.3,              // stroke opacity
                                      false,            // fill (true/false)
                                      "#FFFF00",        // fill color
                                      0.5,              // fill opacity
                                      "Horizon of " + position.vehicle); // tooltip 
      map.addOverlay(horizon_circle);
      subhorizon_circle = new BDCCCircle(point,
                                      circle_radius_km, // radius in km
                                      "#00FF00",        // stroke color
                                      5,                // stroke weight
                                      0.3,              // stroke opacity
                                      false,            // fill (true/false)
                                      "#FFFF00",        // fill color
                                      0.5,              // fill opacity
                                      "5 degree horizon of " + position.vehicle); // tooltip
      map.addOverlay(subhorizon_circle);
      */


    }
    var vehicle_info = {vehicle_type: vehicle_type,
                        marker: marker,
                        image_src: image_src,
                        horizon_circle: horizon_circle,
                        subhorizon_circle: subhorizon_circle,
                        num_positions: 0,
                        positions: [],
                        curr_position: position,
                        line: [],
                        polyline: null,
                        prediction: null,
                        ascent_rate: 0.0,
                        max_alt: parseFloat(position.gps_alt),
                        alt_data: new Array(),
                        path_enabled: vehicle_type == "balloon" && position.vehicle.toLowerCase().indexOf("iss") == -1,
                        follow: false,
                        color_index: color_index};
    vehicles.push(vehicle_info);
    map.addOverlay(marker);
  }
  var vehicle_index = $.inArray(position.vehicle, vehicle_names);
  
  //
  // check if sequence already exists
  //
  var seq = findPosition(vehicles[vehicle_index].positions, position);
  if(seq == -1) {
	  vehicles[vehicle_index].num_positions++;

    var prev_position = vehicles[vehicle_index].curr_position;
    vehicles[vehicle_index].curr_position = insertPosition(vehicles[vehicle_index], position);
    
    // calculate ascent rate:
    if(vehicles[vehicle_index].num_positions == 0) {
      vehicles[vehicle_index].ascent_rate = 0;
    } else if(vehicles[vehicle_index].curr_position != prev_position) { // if not out-of-order
      dt = convert_time(position.gps_time)
         - convert_time(prev_position.gps_time);
      if(dt != 0) {
        rate = (position.gps_alt - prev_position.gps_alt) / dt;
        vehicles[vehicle_index].ascent_rate = 0.7 * rate
                                            + 0.3 * vehicles[vehicle_index].ascent_rate;
      }
    }
	} else { // sequence already exists
    // Doesn't work in IE7 or IE8 :-(
    // if (vehicles[vehicle_index].positions[seq].callsign.split(",").indexOf(position.callsign) === -1)
    if (("," + vehicles[vehicle_index].positions[seq].callsign + ",").indexOf("," + position.callsign + ",") === -1)
      vehicles[vehicle_index].positions[seq].callsign += "," + position.callsign;
	}
  if(parseFloat(position.gps_alt) > vehicles[vehicle_index].max_alt) {
    vehicles[vehicle_index].max_alt = parseFloat(position.gps_alt);
  }
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
  //$('#status_bar').html('<img src="spinner.gif" width="16" height="16" alt="" /> Refreshing receivers ...');

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
  //$('#status_bar').html('<img src="spinner.gif" width="16" height="16" alt="" /> Refreshing predictions ...');

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

  /* a bit of fancy styles */
  //$('status_bar').innerHTML = '<img src="spinner.gif" width="16" height="16" alt="" /> Refreshing ...';

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

function centerAndZoomOnBounds(bounds) {
    var center = bounds.getCenter();
    var newZoom = map.getBoundsZoomLevel(bounds);
    if (map.getZoom() != newZoom) {
      map.setCenter(center, newZoom);
    } else {
      map.panTo(center);
    }
}

var currentPosition = null;

function updateCurrentPosition(lat, lon) {
  var latlng = new google.maps.LatLng(lat, lon);

  if(!currentPosition) {
      currentPosition = {icon: null, marker: null, lat: lat, lon: lon};
      currentPosition.icon = new google.maps.Icon();
      currentPosition.icon.image = "img/marker-you.png";
      currentPosition.icon.iconSize = new GSize(19,40);
      currentPosition.icon.iconAnchor = new GPoint(9,40);
      //currentPosition.icon.infoWindowAnchor = new GPoint(18,5);
      currentPosition.marker = new GMarker(latlng, {icon: currentPosition.icon});
      map.addOverlay(currentPosition.marker);
  } else {
    currentPosition.lat = lat;
    currentPosition.lon = lon;
    currentPosition.marker.setLatLng(latlng);
  }
}

function updateReceiverMarker(receiver) {
  var latlng = new google.maps.LatLng(receiver.lat, receiver.lon);
  if(!receiver.marker) {
    var icon = new google.maps.Icon();
    icon.image = host_url + "images/markers/antenna-green.png";
    icon.iconSize = new GSize(26,32);
    icon.iconAnchor = new GPoint(13,30);
    icon.infoWindowAnchor = new GPoint(13,3);
    receiver.marker = new GMarker(latlng, {icon: icon});
    map.addOverlay(receiver.marker);
  } else {
    receiver.marker.setLatLng(latlng);
  }
  var html = '<b style="font-size:12px">'
           + receiver.name + '</b>'
           + receiver.description;
  GEvent.clearListeners(receiver.marker, "click");
  GEvent.addListener(receiver.marker, "click", function() {
    receiver.marker.openInfoWindowHtml(html);
  });
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
  
  num_updates++;
  var num_positions = response.positions.position.length;
  status = "Received " + num_positions + " new position" + (num_positions == 1 ? "" : "s")+ ".";

  var updated_position = false;
  var pictures_added = false;
  for (i = 0; i < response.positions.position.length; i++) {
    var position = response.positions.position[i];
    if (!position.picture) {
      addPosition(position);
      got_positions = true;
      updated_position = true;
    }
  }

  if(pictures_added) {
    $('#scroll_pane').animate({scrollLeft: '' + $('#scroll_pane').width() + 'px'}, 1000);
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
  	if(vehicles[0].polyline) {
    	centerAndZoomOnBounds(vehicles[0].polyline.getBounds());
    } else {
    	map.setCenter(vehicles[0].line[0]);
    	map.setZoom(10);
    }
    map.savePosition();
    zoomed_in = true;
  }
  
  if(listScroll) listScroll.refresh();
}

function redrawPlot(vehicle_index) {
  var tabname = vehicle_names[vehicle_index].replace("/", "_");
  $.plot($("#graph-"+tabname),
         [{ data: vehicles[vehicle_index].alt_data, color: color_table[vehicle_index]
            /*,label: vehicle_names[vehicle_index]*/}],
                   { xaxis:
                   { mode: "time" },
                   grid: { borderWidth: 1, borderColor: "gray",
                           backgroundColor: { colors: ["#fff", "#eee"] }}});
}

