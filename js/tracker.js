var mission_id = 0;
var position_id = 0;
var data_url = "http://spacenear.us/tracker/datanew.php";
var receivers_url = "http://spacenear.us/tracker/receivers.php";
var predictions_url = "http://spacenear.us/tracker/get_predictions.php";
var host_url = "";
var markers_url = "img/markers/";
var vehicle_names = [];
var vehicles = [];

var receiver_names = [];
var receivers = [];

var got_positions = false;
var zoomed_in = false;
var max_positions = 0; // maximum number of positions that ajax request should return (0 means no maximum)
var follow_vehicle = -1;

var car_index = 0;
var car_colors = ["blue", "red", "green", "yellow"];
var balloon_index = 0;
var balloon_colors_name = ["red", "blue", "green", "yellow", "purple", "orange", "cyan"];
var balloon_colors = ["#f00", "blue", "green", "#ff0", "#c700e6", "#ff8a0f", "#0fffca"];

var map = null;
var overlay = null;
var layer_clouds = null;

var notamOverlay = null;

// order of map elements
var Z_RANGE = 1;
var Z_STATION = 2;
var Z_PATH = 10;
var Z_ME = 11;
var Z_SHADOW = 1000000;
var Z_CAR = 1000001;
var Z_PAYLOAD = 1000002;

// localStorage vars
var ls_receivers = false;
var ls_pred = false;

var plot = null;
var plot_open = false;

// weather
var weatherOverlayId = "nexrad-n0q-900913";
var weatherOverlay = new google.maps.ImageMapType({
    getTileUrl: function(tile, zoom) {
        return "http://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/"+weatherOverlayId+"/" + zoom + "/" + tile.x + "/" + tile.y +".png";
    },
    tileSize: new google.maps.Size(256, 256),
    opacity:0.8,
    isPng: true
});

var weatherImageOverlayList = {
    'nrl-global-cloudtop': ['http://www.nrlmry.navy.mil/archdat/global/stitched/cloudtop/LATEST.jpg', [[-76, -179.9999], [76, 179.75]]],
    'nrl-global-ir': ['http://www.nrlmry.navy.mil/archdat/global/stitched/ir/LATEST.jpg', [[-65, -179.9999], [65, 179.75]]],
    'nrl-global-vapor': ['http://www.nrlmry.navy.mil/archdat/global/stitched/vapor/LATEST.jpg', [[-65, -179.9999], [65, 179.75]]],
    'meteosat-Odeg-MPE': ['http://oiswww.eumetsat.int/IPPS/html/GE/MET0D/GE_MET0D_VP-MPE.png', [[-57.492200, -57.492200], [57.492200, 57.492200]]],
    'meteosat-iodc-MPE': ['http://oiswww.eumetsat.int/IPPS/html/GE/IODC/GE_IODC_VP-MPE.png', [[-59.7901, -2.7919], [59.7901, 116.7913]]]
};

var weatherImageOverlay = new google.maps.GroundOverlay();
var weatherGoogleRadar = new google.maps.KmlLayer({url:'http://mw1.google.com/mw-weather/radar/root.kmz', preserveViewport: true});

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

var DEG_TO_RAD = Math.PI / 180.0;
var EARTH_RADIUS = 6371000.0;

// calculates look angles between two points
// format of a and b should be {lon: 0, lat: 0, alt: 0}
// returns {elevention: 0, azimut: 0, bearing: "", range: 0}
//
// based on earthmath.py
// Copyright 2012 (C) Daniel Richman; GNU GPL 3
function calculate_lookangles(a, b) {
    // degrees to radii
    a.lat = a.lat * DEG_TO_RAD;
    a.lon = a.lon * DEG_TO_RAD;
    b.lat = b.lat * DEG_TO_RAD;
    b.lon = b.lon * DEG_TO_RAD;

    var d_lon = b.lon - a.lon;
    var sa = Math.cos(b.lat) * Math.sin(d_lon);
    var sb = (Math.cos(a.lat) * Math.sin(b.lat)) - (Math.sin(a.lat) * Math.cos(b.lat) * Math.cos(d_lon));
    var bearing = Math.atan2(sa, sb);
    var aa = Math.sqrt(Math.pow(sa, 2) + Math.pow(sb, 2));
    var ab = (Math.sin(a.lat) * Math.sin(b.lat)) + (Math.cos(a.lat) * Math.cos(b.lat) * Math.cos(d_lon));
    var angle_at_centre = Math.atan2(aa, ab);
    var great_circle_distance = angle_at_centre * EARTH_RADIUS

    ta = EARTH_RADIUS + a.alt;
    tb = EARTH_RADIUS + b.alt;
    ea = (Math.cos(angle_at_centre) * tb) - ta;
    eb = Math.sin(angle_at_centre) * tb;
    var elevation = Math.atan2(ea, eb) / DEG_TO_RAD;

    // Use Math.coMath.sine rule to find unknown side.
    var distance = Math.sqrt(Math.pow(ta, 2) + Math.pow(tb, 2) - 2 * tb * ta * Math.cos(angle_at_centre));

    // Give a bearing in range 0 <= b < 2pi
    bearing += (bearing < 0) ? 2 * Math.PI : 0;
    bearing /= DEG_TO_RAD;

    var value = Math.round(bearing % 90);
    value = ((bearing > 90 && bearing < 180) || (bearing > 270 && bearing < 360)) ? 90 - value : value;

    var str_bearing = "" + ((bearing < 90 || bearing > 270) ? 'N' : 'S')+ " " + value + '° ' + ((bearing < 180) ? 'E' : 'W');

    return {
        'elevation': elevation,
        'azimuth': bearing,
        'range': distance,
        'bearing': str_bearing
    }
}

function update_lookangles(idx) {
    if(GPS_ts == null) { return; }
    else if($("#lookanglesbox span").first().is(":hidden")) {
        $("#lookanglesbox div").hide().parent().find("span").show();
    }

    var a = {lat: GPS_lat, lon: GPS_lon, alt: GPS_alt};

    var xref = vehicles[idx].curr_position;
    var b = {lat: parseFloat(xref.gps_lat), lon: parseFloat(xref.gps_lon), alt: parseFloat(xref.gps_alt)};

    var look = calculate_lookangles(a,b);

    $("#lookanglesbox .azimuth").text("Azimuth: " + Math.round(look.azimuth * 10000)/10000 + "°");
    $("#lookanglesbox .bearing").text(look.bearing);
    $("#lookanglesbox .elevation").text("Elevation: " + Math.round(look.elevation * 10000)/10000 + "°");

    var range_string = "";
    if(offline.get('opt_imperial')) {
        range_string =  Math.round(look.range * 0.000621371192) + " miles";
    } else {
        range_string = (look.range < 10000) ? Math.round(look.range) + "m" : (Math.round(look.range/100)/10) + " km";
    }
    $("#lookanglesbox .range").text(range_string);
}

function makeQuad(x, y, zoom) {
    var quad = "";
    for (var i = zoom; i > 0; i--) {
      var mask = 1 << (i - 1);
      var cell = 0;
      if ((x & mask) != 0) cell++;
      if ((y & mask) != 0) cell += 2;
      quad += cell;
    }
    return quad;
}

// wraps tiles horizontally, returns x
function wrapTiles(x, zoom) {
    var n = Math.pow(2,zoom);
    return (x<0) ? (n+(x%n))%n : x%n;
}

// map type list
// format: [ name, attr, minZoom, maxZoom, getTileUrl function ]
var maptypes = {
    bing_os: [
        'Ordnance Survey (UK)',
        'Bing.com & Ordnance Survey',
         10,
         17,
         function(xy,z) { return 'http://ecn.t'+(Math.round(Math.random()*3)+1)+'.tiles.virtualearth.net/tiles/r'+makeQuad(xy.x, xy.y, z)+'?g=2689&lbl=l1&productSet=mmOS'; }
    ],
    osm: [
        'OSM',
        'OpenStreetMaps.org',
         1,
         19,
         function(xy,z) { var n = Math.pow(2,z); return (xy.y<0 || xy.y>=n) ? null : 'http://'+['a','b','c'][Math.round(Math.random()*2)]+'.tile.openstreetmap.org/'+z+'/'+wrapTiles(xy.x,z)+'/'+xy.y+'.png'; }
    ],
    osm_bw: [
        'OSM B&W',
        'OSM Black & White',
         1,
         16,
         function(xy,z) { var n = Math.pow(2,z); return (xy.y<0 || xy.y>=n) ? null : 'http://'+['a','b','c','d','e'][Math.round(Math.random()*2)]+'.www.toolserver.org/tiles/bw-mapnik/'+z+'/'+wrapTiles(xy.x,z)+'/'+xy.y+'.png'; }
    ],
    osm_toner: [
        'OSM Toner',
        'Stamen.org Toner',
         1,
         18,
         function(xy,z) { var n = Math.pow(2,z); return (xy.y<0 || xy.y>=n) ? null : 'http://'+['a','b','c','d'][Math.round(Math.random()*2)]+'.tile.stamen.com/toner/'+z+'/'+wrapTiles(xy.x,z)+'/'+xy.y+'.png'; }
    ],
    osm_watercolor: [
        'OSM Watercolor',
        'Stamen.org Watercolor',
         1,
         18,
         function(xy,z) { var n = Math.pow(2,z); return (xy.y<0 || xy.y>=n) ? null : 'http://'+['a','b','c','d'][Math.round(Math.random()*2)]+'.tile.stamen.com/watercolor/'+z+'/'+wrapTiles(xy.x,z)+'/'+xy.y+'.png'; }
    ]
}

// generate a list of names for the UI
var maptype_ids = ["roadmap","satellite","terrain"]
for(var i in maptypes) maptype_ids.push(i);


// mousemove event throttle hack for smoother maps pan on firefox and IE
// taken from: http://stackoverflow.com/questions/22306130/how-to-limit-google-maps-api-lag-when-panning-the-map-with-lots-of-markers-and-p

var mthrottle_last = {
                        time : 0,     // last time we let an event pass.
                        x    : -100,  // last x position af the event that passed.
                        y    : -100   // last y position af the event that passed.
                     };
var mthrottle_period = 16;   // ms - don't let pass more than one event every 100ms.
var mthrottle_space  = 40;    // px - let event pass if distance between the last and
                              //      current position is greater than 2 px.

function throttle_events(event) {
    var now = window.performance.now();
    var distance = Math.sqrt(Math.pow(event.clientX - mthrottle_last.x, 2) + Math.pow(event.clientY - mthrottle_last.y, 2));
    var time = now - mthrottle_last.time;
    if (distance * time < mthrottle_space * mthrottle_period) {    //event arrived too soon or mouse moved too little or both
        if (event.stopPropagation) { // W3C/addEventListener()
            event.stopPropagation();
        } else { // Older IE.
            event.cancelBubble = true;
        };
    } else {
        mthrottle_last.time = now;
        mthrottle_last.x    = event.clientX;
        mthrottle_last.y    = event.clientY;
    };
};

function load() {
    //initialize map object
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 5,
        center: new google.maps.LatLng(53.467511,-2.2338940),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControlOptions: {
            mapTypeIds: maptype_ids,
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
        },
        keyboardShortcuts: false,
        streetViewControl: false,
        rotateControl: false,
        panControl: false,
        scaleControl: true,
        zoomControl: true,
        zoomControlOptions: {
            style: google.maps.ZoomControlStyle.DEFAULT
        },
        scrollwheel: true
    });

    if(window.performance && window.performance.now && window.navigator.userAgent.indexOf("Firefox") != -1) {
        document.getElementById('map').addEventListener("mousemove", throttle_events, true);
    }

    // register custom map types
    for(var i in maptypes) {
        map.mapTypes.set(i, new google.maps.ImageMapType({
            name: maptypes[i][0],
            minZoom: maptypes[i][2],
            maxZoom: maptypes[i][3],
            getTileUrl: maptypes[i][4],
            tileSize: new google.maps.Size(256, 256),
        }));
    }

    // update current position if we geolocation is available
    if(currentPosition) updateCurrentPosition(currentPosition.lat, currentPosition.lon);

    // initalize nite overlay
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

    // animate-in the timebox,
    setTimeout(function() {
        var elm = $("#timebox");

        if(is_mobile) $(".slickbox").css({left:'5px'});
        var origW = elm.width();
        var iconW = elm.find("svg").width();

        if(offline.get('opt_hide_timebox')) {
            elm.removeClass('animate').hide();
            $("#lookanglesbox").css({top:'7px'});
        };

        // prep for animation
        $(".slickbox.animate").css({width:iconW}).find("span").hide();

        if(!offline.get('opt_hide_timebox')) {
            // animate timebox
            elm.fadeIn(500,"easeOut").animate({width:origW},400,"easeOut", function() {
              $("#timebox span").fadeIn(500, "easeOut");
            });
        }

        // animate lookanglesbox, delayed start by 300ms
        $("#lookanglesbox").delay(200).fadeIn(500,"easeOut").animate({width:origW},400,"easeOut", function() {
          if(GPS_ts == null) {
              $("#lookanglesbox .nopos").fadeIn(500, "easeOut");
          } else if($("#lookanglesbox span:first").is(":hidden")) {
              $("#lookanglesbox .nofollow").fadeIn(500, "easeOut");
          }
        });
    }, 500);

    // initialize clouds layer
    layers_clouds = new google.maps.weather.CloudLayer();
    if(offline.get('opt_layers_clouds')) layers_clouds.setMap(map);
}

function unload() {
  google.maps.Unload();
}

function panTo(vehicle_index) {
    if(vehicle_index < 0) return;

    // update lookangles
    update_lookangles(vehicle_index);

    // pan map
    if(vehicles[vehicle_index].marker_shadow) map.panTo(vehicles[vehicle_index].marker_shadow.getPosition());
    else map.panTo(vehicles[vehicle_index].marker.getPosition());
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
        // remove target mark
        $("#main .row.follow").removeClass("follow");

        vehicles[follow_vehicle].follow = false;
        follow_vehicle = -1;

        // reset nite overlay
        nite.setDate(null);
        nite.refresh();

        // update lookangles box
        if(GPS_ts != null) $("#lookanglesbox span").hide().parent().find(".nofollow").show();
    }
}

function followVehicle(index) {
	if(follow_vehicle != -1  && vehicles.length) vehicles[follow_vehicle].follow = false;

    if(follow_vehicle != index) {
		follow_vehicle = index;
		vehicles[follow_vehicle].follow = true;

        // add target mark
        $("#main .row.follow").removeClass("follow");
        $("#main .vehicle"+follow_vehicle).addClass("follow");

        updateGraph(index, true);
	}

    panTo(index);
}

function roundNumber(number, digits) {
  var multiple = Math.pow(10, digits);
  var rndedNum = Math.round(number * multiple) / multiple;
  return rndedNum;
}

function convert_time(text) {
    var b = text.split(/[^0-9]/);
    return Date.UTC(b[0],--b[1],b[2],b[3],b[4],b[5]);
}

function stringToDateUTC(text) {
    return new Date(convert_time(text));
}

function formatDate(date,utc) {
    var a,b,c,d,e,f,g,z;

    a = date.getFullYear();
    b = twoZeroPad(date.getMonth()+1); // months 0-11
    c = twoZeroPad(date.getDate());
    e = twoZeroPad(date.getHours());
    f = twoZeroPad(date.getMinutes());
    g = twoZeroPad(date.getSeconds());

    if(typeof utc != "undefined") {
        z = date.getTimezoneOffset() / -60;
        return a+'-'+b+'-'+c+' '+e+':'+f+':'+g+" UTC"+((z<0)?"-":"+")+z;
    } else {
        return a+'-'+b+'-'+c+' '+e+':'+f+':'+g;
    }
}

function updateVehicleInfo(index, newPosition) {
  var vehicle = vehicles[index];
  var latlng = new google.maps.LatLng(newPosition.gps_lat, newPosition.gps_lon);

  // update market z-index based on latitude, 90 being background and -90 foreground
  // the first 2 decimal digits are included for added accuracy
  var zIndex = 900000 - parseInt(newPosition.gps_lat*10000);

  // update position
  if(vehicle.marker_shadow) {
      vehicle.marker_shadow.setPosition(latlng);
      vehicle.marker_shadow.setZIndex(Z_SHADOW + zIndex);
  }
  vehicle.marker.setPosition(latlng);
  vehicle.marker.setZIndex(((vehicle.vehicle_type=="car")? Z_CAR : Z_PAYLOAD) + zIndex);

  // update horizon circles and icon
  if(vehicle.vehicle_type == "balloon") {
    updateAltitude(index);
    var horizon_km = Math.sqrt(12.756 * newPosition.gps_alt);
    vehicle.horizon_circle.setRadius(Math.round(horizon_km)*1000);

    if(vehicle.subhorizon_circle) {
      // see: http://ukhas.org.uk/communication:lineofsight
      var el = 5.0; // elevation above horizon
      var h = parseFloat(newPosition.gps_alt); // height above ground

      var elva = el * DEG_TO_RAD;
      var slant = EARTH_RADIUS*(Math.cos(Math.PI/2+elva)+Math.sqrt(Math.pow(Math.cos(Math.PI/2+elva),2)+h*(2*EARTH_RADIUS+h)/Math.pow(EARTH_RADIUS,2)));
      var subhorizon_km = Math.acos((Math.pow(EARTH_RADIUS,2)+Math.pow(EARTH_RADIUS+h,2)-Math.pow(slant,2))/(2*EARTH_RADIUS*(EARTH_RADIUS+h)))*EARTH_RADIUS;

      vehicle.subhorizon_circle.setRadius(Math.round(subhorizon_km));
    }

    // indicates whenever a payload has landed
    var landed = (
                     vehicle.max_alt > 1500         // if it has gone up
                     && vehicle.ascent_rate < 1.0   // and has negative ascent_rate, aka is descending
                     && newPosition.gps_alt < 350              // and is under 350 meters altitude
                 ) || (                                     // or
                     newPosition.gps_alt < 600                 // under 600m and has no position update for more than 30 minutes
                     && (new Date().getTime() - convert_time(newPosition.gps_time)) > 1800000
                 );

    if(landed) {
      vehicle.marker.setMode("landed");
      vehicle.marker.shadow.setVisible(false);
      vehicle.horizon_circle.setVisible(false);
      vehicle.subhorizon_circle.setVisible(false);

    } else if(vehicle.ascent_rate > -3.0 ||
              vehicle_names[index] == "wb8elk2") {
    	vehicle.marker.setMode("balloon");
    } else {
    	vehicle.marker.setMode("parachute");
    }
  }

  var image = vehicle.image_src;

  var elm = $('.vehicle' + index);

  // if the vehicle doesn't exist in the list
  if (elm.length == 0) {
    $('.portrait').append('<div class="row vehicle'+index+'"></div>');
    $('.landscape').append('<div class="row vehicle'+index+'"></div>');

  }

  // decides how to dispaly the horizonal speed
  var imp = offline.get('opt_imperial');
  var ascent_text = imp ? (vehicle.ascent_rate * 196.850394).toFixed(1) + ' ft/min' : vehicle.ascent_rate.toFixed(1) + ' m/s';
  if (offline.get('opt_haxis_hours')) {
          var hrate_text = imp ? (vehicle.horizontal_rate * 2.23693629).toFixed(1) + ' mph' : (vehicle.horizontal_rate * 3.6).toFixed(1) + ' km/h';
  } else {
          var hrate_text = imp ? (vehicle.horizontal_rate * 196.850394).toFixed(1) + ' ft/min' : vehicle.horizontal_rate.toFixed(1) + ' m/s';
  }

  var coords_text;
  var ua =  navigator.userAgent.toLowerCase();

  // determine how to link the vehicle coordinates to a native app, if on a mobile device
  if(ua.indexOf('iphone') > -1) {
      coords_text = '<a id="launch_mapapp" href="maps://?q='+newPosition.gps_lat+','+newPosition.gps_lon+'">'
                    + roundNumber(newPosition.gps_lat, 6) + ', ' + roundNumber(newPosition.gps_lon, 6) +'</a>'
                    + ' <i class="icon-location"></i>';
  } else if(ua.indexOf('android') > -1) {
      coords_text = '<a id="launch_mapapp" href="geo:'+newPosition.gps_lat+','+newPosition.gps_lon+'?q='+newPosition.gps_lat+','+newPosition.gps_lon+'('+vehicle_names[index]+')">'
                    + roundNumber(newPosition.gps_lat, 6) + ', ' + roundNumber(newPosition.gps_lon, 6) +'</a>'
                    + ' <i class="icon-location"></i>';
  } else {
      coords_text = roundNumber(newPosition.gps_lat, 6) + ', ' + roundNumber(newPosition.gps_lon, 6);
  }

  // format altitude strings
  var text_alt      = Number((imp) ? Math.floor(3.2808399 * parseInt(newPosition.gps_alt)) : parseInt(newPosition.gps_alt)).toLocaleString("us");
      text_alt     += " " + ((imp) ? 'ft':'m');
  var text_alt_max  = Number((imp) ? Math.floor(3.2808399 * parseInt(vehicle.max_alt)) : parseInt(vehicle.max_alt)).toLocaleString("us");
      text_alt_max += " " + ((imp) ? 'ft':'m');


  // start
  var a    = '<div class="header">'
           + '<span>' + vehicle_names[index] + ' <i class="icon-target"></i></span>'
           + '<canvas class="graph"></canvas>'
           + '<i class="arrow"></i></div>'
           + '<div class="data">'
           + '<img class="'+((vehicle.vehicle_type=="car")?'car':'')+'" src="'+image+'" />'
           + ((vehicle_names[index] in hysplit) ? '<span class="hysplit '+((hysplit[vehicle_names[index]].getMap()) ? 'active' : '')+'" data-index="'+index+'">HYSPLIT</span>' : '')
           + '<div class="left">'
           + '<dl>';
  // end
  var b    = '</dl>'
           + '</div>' // right
           + '</div>' // data
           + '';
  var c    = '<dt class="receivers">Recieved <i class="friendly-dtime" data-timestamp='+(convert_time(newPosition.server_time))+'></i> via:</dt><dd class="receivers">'
           + newPosition.callsign.split(",").join(", ") + '</dd>'

  if(!newPosition.callsign) c = '';


  // mid for portrait
  var p    = '<dt>'+formatDate(stringToDateUTC(newPosition.gps_time))+'</dt><dd>datetime (local)</dd>'
           + '<dt>'+coords_text+'</dt><dd>coordinates</dd>'
           + c // receivers if any
           + '</dl>'
           + '</div>' // left
           + '<div class="right">'
           + '<dl>'
           + ((vehicle.vehicle_type == "car") ? '' : '<dt>'+ascent_text+' '+hrate_text+'</dt><dd>rate v|h</dd>')
           + '<dt>'+text_alt+'</dt><dd>altitude</dd>'
           + '<dt>'+text_alt_max+'</dt><dd>max alt</dd>'
           + '';
  // mid for landscape
  var l    = ((vehicle.vehicle_type == "car") ? '' : '<dt>'+ascent_text+' '+hrate_text+'</dt><dd>rate v|h</dd>')
           + '<dt>'+text_alt+' ('+text_alt_max+')</dt><dd>altitude (max)</dd>'
           + '<dt>'+formatDate(stringToDateUTC(newPosition.gps_time))+'</dt><dd>datetime (local)</dd>'
           + '<dt>'+coords_text+'</dt><dd>coordinates</dd>'
           + habitat_data(newPosition.data)
           + c // receivers if any
           + '';

  // update html
  $('.portrait .vehicle'+index).html(a + p + b);
  $('.landscape .vehicle'+index).html(a + l + b);

  // redraw canvas
  var c = $('.vehicle'+index+' .graph');
  drawAltitudeProfile(c.get(0), c.get(1), vehicles[index].alt_list, vehicles[index].alt_max);

  // mark vehicles as redrawn
  vehicles[index].updated = false;

  return true;
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
    var path_length = 0;

    for(var i = 0, ii = data.length; i < ii; i++) {
        latlng = new google.maps.LatLng(data[i].lat, data[i].lon);
        line.push(latlng);

        if(parseFloat(data[i].alt) > max_alt) {
            max_alt = parseFloat(data[i].alt);
            latlng_burst = latlng;
            burst_index = i;
        }
        if(i > 1) path_length += google.maps.geometry.spherical.computeDistanceBetween(line[i-1], line[i]);
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
            clickable: true,
            draggable: false,
        });
        google.maps.event.addListener(vehicle.prediction_polyline, 'click', mapInfoBox_handle_path);
    }

    vehicle.prediction_polyline.path_length = path_length;

    var image_src;
    if(vehicle_names[vehicle_index] != "wb8elk2") { // WhiteStar
        var html = "";
        if(vehicle.prediction_target) {
            vehicle.prediction_target.setPosition(latlng);
        } else {
            image_src = host_url + markers_url + "target-" + balloon_colors_name[vehicle.color_index] + ".png";
            vehicle.prediction_target = new google.maps.Marker({
                position: latlng,
                optimized: false,
                zIndex: Z_SHADOW,
                icon: {
                    url: image_src,
                    scaledSize: new google.maps.Size(20,20),
                    size: new google.maps.Size(20,20),
                    anchor: new google.maps.Point(10, 10)
                },
                map: map,
                clickable: true
            });
            google.maps.event.addListener(vehicle.prediction_target, 'click', mapInfoBox_handle_prediction);
        }
        vehicle.prediction_target.pdata = data[data.length-1];
    } else {
        if(vehicle.prediction_target) vehicle.prediction_target = null;
    }

    if(burst_index != 0 && vehicle_names[vehicle_index] != "wb8elk2") {
        if(vehicle.prediction_burst) {
            vehicle.prediction_burst.setPosition(latlng_burst);
        } else {
            image_src = host_url + markers_url + "balloon-pop.png";
            vehicle.prediction_burst =  new google.maps.Marker({
                position: latlng_burst,
                optimized: false,
                zIndex: Z_SHADOW,
                icon: {
                    url: image_src,
                    scaledSize: new google.maps.Size(20,20),
                    size: new google.maps.Size(20,20),
                    anchor: new google.maps.Point(10, 10)
                },
                map: map,
                clickable: true
            });
            google.maps.event.addListener(vehicle.prediction_burst, 'click', mapInfoBox_handle_prediction);
        }
        vehicle.prediction_burst.pdata = data[burst_index];
    } else {
        if(vehicle.prediction_burst) vehicle.prediction_burst = null;
    }
}

function updatePolyline(vehicle_index) {
    for(k in vehicles[vehicle_index].polyline) {
        vehicles[vehicle_index].polyline[k].setPath(vehicles[vehicle_index].positions);
    }
}

function drawAltitudeProfile(c1, c2, alt_list, alt_max) {
    alt_max = (alt_max < 2000) ? 2000 : alt_max;

    var ctx1 = c1.getContext("2d");
    var ctx2 = c2.getContext("2d");

    c1 = $(c1);
    c2 = $(c2);

    var ratio = window.devicePixelRatio;
    var cw1 = 150 * ratio;
    var ch1 = 40 * ratio;
    var cw2 = 60 * ratio;
    var ch2 = 40 * ratio;

    c1.attr('width', cw1).attr('height', ch1);
    c2.attr('width', cw2).attr('height', ch2);

    ctx1.fillStyle = "#d6f0f9";
    ctx1.lineWidth = 2 * ratio;
    ctx1.strokeStyle= "#33B5F5";
    ctx2.fillStyle = "#d6f0f9";
    ctx2.lineWidth = 2 * ratio;
    ctx2.strokeStyle= "#33B5F5";

    var xt1 = (cw1 - (2 * ratio)) / alt_list.length;
    var yt1 = (ch1 - (6 * ratio)) / alt_max;
    var xt2 = (cw2 - (2 * ratio)) / alt_list.length;
    var yt2 = (ch2 - (6 * ratio)) / alt_max;

    xt1 = (xt1 > 1) ? 1 : xt1;
    yt1 = (yt1 > 1) ? 1 : yt1;
    xt2 = (xt2 > 1) ? 1 : xt2;
    yt2 = (yt2 > 1) ? 1 : yt2;

    ctx1.beginPath();
    ctx1.moveTo(0,c1.height);
    ctx2.beginPath();
    ctx2.moveTo(0,c2.height);

    var i;
    for(i = 0; i < alt_list.length; i++) {
        ctx1.lineTo(1+((i+1)*xt1), ch1 - (alt_list[i] * yt1));
        ctx2.lineTo(1+((i+1)*xt2), ch2 - (alt_list[i] * yt2));
    }

    ctx1.stroke();
    ctx2.stroke();

    ctx1.lineTo(1+((i+1)*xt1), ch1);
    ctx2.lineTo(1+((i+1)*xt2), ch2);

    ctx1.closePath();
    ctx2.closePath();
    ctx1.fill();
    ctx2.fill();
}

// infobox
var mapInfoBox = new google.maps.InfoWindow();

var mapInfoBox_handle_path = function(event) {
    var value = ("path_length" in this) ? this.path_length : this.vehicle.path_length;

    if(offline.get('opt_imperial')) {
        value = Math.round(value*0.000621371192) + " miles";
    } else {
        value = Math.round(value/10)/100 + " km";
    }

    var duration = ("vehicle" in this) ? "\n<b>Duration:</b> " + format_time_friendly(this.vehicle.start_time, convert_time(this.vehicle.curr_position.gps_time)) : '';

    mapInfoBox.setContent("<pre><b>Length:</b> " + value + duration + "</pre>");
    mapInfoBox.setPosition(event.latLng);
    mapInfoBox.open(map);
}
var mapInfoBox_handle_prediction = function(event) {
    var data = this.pdata;
    var altitude;

    if(offline.get('opt_imperial')) {
        altitude = Math.round(alt*3.2808399) + " feet";
    } else {
        altitude = Math.round(data.alt) + " m";
    }

    mapInfoBox.setContent("<pre>"
                        + formatDate(new Date(parseInt(data.time) * 1000), true) + "\n\n"
                        + "<b>Altitude:</b> " + altitude + "\n"
                        + "<b>Latitude:</b> " + data.lat + "\n"
                        + "<b>Longtitude:</b> " + data.lon + "\n"
                        + "</pre>"
                        );
    mapInfoBox.setPosition(event.latLng);
    mapInfoBox.open(map);
}
var mapInfoBox_handle_horizons = function(event, obj,  title) {
    var value = "";

    if(offline.get('opt_imperial')) {
        value = Math.round(obj.getRadius()*0.000621371192) + "miles";
    } else {
        value = Math.round(obj.getRadius()/10)/100 + "km";
    }


    mapInfoBox.setContent("<pre>" + title + "\nr = "+ value + "</pre>");
    mapInfoBox.setPosition(event.latLng);
    mapInfoBox.open(map);
}

var mapInfoBox_handle_truehorizon = function(event) { mapInfoBox_handle_horizons(event, this, "True Horizon"); }
var mapInfoBox_handle_horizon = function(event) { mapInfoBox_handle_horizons(event, this, "5° Horizon"); }

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
        if(position.vehicle.search(/(chase)/i) != -1  // whitelist
           && position.vehicle.search(/icarus/i) == -1) {  // blacklist
            vehicle_type = "car";
            color_index = car_index++;
            var c = color_index % car_colors.length;
            var image_src = host_url + markers_url + "car-" + car_colors[c] + ".png";

            marker = new google.maps.Marker({
                icon: {
                    url: image_src,
                    size: new google.maps.Size(55,25),
                    scaledSize: new google.maps.Size(55,25),
                    anchor: new google.maps.Point(27,22)
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
                            path_length: 0,
                            curr_position: position,
                            line: [],
                            polyline: [new google.maps.Polyline({
                                map: map,
                                zIndex: Z_PATH,
                                strokeColor: balloon_colors[c],
                                strokeOpacity: 0.8,
                                strokeWeight: 3,
                                clickable: true,
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
                            graph_yaxes: [],
                            updated: false,
                            start_time: 2147483647000
                            };

        // deep copy yaxes config for graph
        if(plot) $.each($.extend(false, plot_options.yaxes, {}), function(k,v) { vehicle_info.graph_yaxes.push(v) });

        // nyan mod
        if(nyan_mode && vehicle_info.vehicle_type == "balloon") {
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

            for(var k in rainbow) {
                vehicle_info.polyline.push(new google.maps.Polyline({
                                map: map,
                                zIndex: (Z_PATH - (k * 1)),
                                strokeColor: rainbow[k],
                                strokeOpacity: 1,
                                strokeWeight: (k*4) + 2,
                                clickable: true,
                                draggable: false,
                            }));
            }
        }

        // hook infobox

        // polyline
        for(var k in vehicle_info.polyline) {
            vehicle_info.polyline[k].vehicle = vehicle_info;
            google.maps.event.addListener(vehicle_info.polyline[k], 'click', mapInfoBox_handle_path);
        }

        // horizon circles
        if(vehicle_info.horizon_circle) google.maps.event.addListener(vehicle_info.horizon_circle, 'click', mapInfoBox_handle_truehorizon);
        if(vehicle_info.subhorizon_circle) google.maps.event.addListener(vehicle_info.subhorizon_circle, 'click', mapInfoBox_handle_horizon);

        // let the nyan free
        vehicles.push(vehicle_info);
    }


    var vehicle_index = $.inArray(position.vehicle, vehicle_names);
    var vehicle = vehicles[vehicle_index];

    if(vehicle.vehicle_type == "balloon") {
        var new_latlng = new google.maps.LatLng(position.gps_lat, position.gps_lon);
        var dt = (convert_time(position.gps_time) - convert_time(vehicle.curr_position.gps_time)) / 1000; // convert to seconds

        if(dt == 0) {
            if (("," + vehicle.curr_position.callsign + ",").indexOf("," + position.callsign + ",") === -1) {
              vehicle.curr_position.callsign += "," + position.callsign;
            }

            vehicle.updated = true;
        }
        else if(dt > 0) {
            if(vehicle.num_positions > 0) {
                // calculate vertical rate
                var rate = (position.gps_alt - vehicle.curr_position.gps_alt) / dt;
                vehicle.ascent_rate = 0.7 * rate
                                      + 0.3 * vehicle.ascent_rate;

                // calculate horizontal rate
                vehicle.horizontal_rate = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(position.gps_lat, position.gps_lon),
                                                                                                new google.maps.LatLng(vehicle.curr_position.gps_lat, vehicle.curr_position.gps_lon)) / dt;
             }

            // record altitude values for the drowing a mini profile
            // only record altitude values in 2minute interval
            if(convert_time(vehicle.curr_position.gps_time) - vehicle.time_last_alt >= 120000) { // 120s = 2minutes
                vehicle.time_last_alt = convert_time(vehicle.curr_position.gps_time);
                var alt = parseInt(vehicle.curr_position.gps_alt);

                if(alt > vehicle.alt_max) vehicle.alt_max = alt; // larged value in the set is required for encoding later

                vehicle.alt_list.push(alt); // push value to the list
            }

            // add the new position
            if(!vehicle.curr_position
               || vehicle.curr_position.gps_lat != position.gps_lat
               || vehicle.curr_position.gps_lon != position.gps_lon) {
                // add the new position
                vehicle.positions.push(new_latlng);
                vehicle.num_positions++;

                vehicle.curr_position = position;
                graphAddLastPosition(vehicle_index);
                vehicle.updated = true;

                var poslen = vehicle.num_positions;
                if(poslen > 1) vehicle.path_length += google.maps.geometry.spherical.computeDistanceBetween(vehicle.positions[poslen-2], vehicle.positions[poslen-1]);
            }
        }

    } else { // if car
        vehicle.updated = true;
        vehicle.curr_position = position;
    }

    // record the start of flight
    var newts = convert_time(vehicle.curr_position.gps_time);
    if(newts < vehicle.start_time) {
        vehicle.start_time = newts;
    }

    // record the highest altitude
    if(parseFloat(position.gps_alt) > vehicle.max_alt) {
        vehicle.max_alt = parseFloat(position.gps_alt);
    }

    return;
}

function updateGraph(idx, reset_selection) {
    if(!plot || !plot_open) return;

    if(polyMarker) polyMarker.setPosition(null);

    if(reset_selection) {
        delete plot_options.xaxis;

        // reset nite overlay
        nite.setDate(null);
        nite.refresh();
    }

    // replot graph, with this vehicle data, and this vehicles yaxes config
    plot = $.plot(plot_holder, vehicles[idx].graph_data, $.extend(false, plot_options, {yaxes:vehicles[idx].graph_yaxes}));

    vehicles[idx].graph_data_updated = false;
}

function graphAddLastPosition(idx) {
    if(!plot) return;

    vehicles[idx].graph_data_updated = true;
    var data = vehicles[idx].graph_data;
    var new_data = vehicles[idx].curr_position;
    var ts = convert_time(new_data.gps_time);

    if(vehicles[idx].graph_data.length) {
        var ts_last_idx = data[0].data.length - 1;
        var ts_last = data[0].data[ts_last_idx][0];

        //insert gap when there are 3mins, or more, without telemetry
        var gap_size = 180000; // 3 mins in milis
        var pad_size = 120000; // 2 min

        if(ts_last + gap_size < ts) {
            $.each(data, function(k,v) {
                v.data.push([ts_last+pad_size, v.data[v.data.length - 1][1]]);
                v.data.push([ts_last+pad_size+1, null]);
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

  //if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'ajax', 'refresh', 'Vehicles']);

  $.ajax({
    type: "GET",
    url: data_url,
    data: "format=json&max_positions=" + max_positions + "&position_id=" + position_id + "&vehicles=" + encodeURIComponent(vfilter),
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
    // if options to hide receivers is selected do nothing
    if(offline.get('opt_hide_receivers')) return;

    //if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'ajax', 'refresh', 'Recievers']);

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
    //if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'ajax', 'refresh', 'Predictions']);

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
            periodical_predictions = setTimeout(refreshPredictions, 60 * 1000);
        }
    });
}

var periodical, periodical_receivers, periodical_predictions;
var timer_seconds = 15;

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
                anchor: new google.maps.Point(10,50)
            },
            zIndex: Z_ME,
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

  // init a marker if the receiver doesn't already have one
  if(!receiver.marker) {
    receiver.marker = new google.maps.Marker({
        icon: {
            url: host_url + markers_url + "antenna-green.png",
            size: new google.maps.Size(26,34),
            scaledSize: new google.maps.Size(26,34),
            anchor: new google.maps.Point(13,34),
        },
        zIndex: Z_STATION,
        position: latlng,
        map: map,
        optimized: false,
        title: receiver.name,
        animation: google.maps.Animation.DROP
    });
    receiver.infobox = new google.maps.InfoWindow({
        content: receiver.description
    });
    receiver.infobox_handle = google.maps.event.addListener(receiver.marker, 'click', function() {
              receiver.infobox.open(map, receiver.marker);
    });
  } else {
    receiver.marker.setPosition(latlng);
  }
}

function updateReceivers(r) {
    if(!r) return;
    ls_receivers = true;

    var i = 0, ii = r.length;
    for(; i < ii; i++) {
        var lat = parseFloat(r[i].lat);
        var lon = parseFloat(r[i].lon);

        if(lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

        var r_index = $.inArray(r[i].name, receiver_names);

        if(r_index == -1) {
            receiver_names.push(r[i].name);
            r_index = receiver_names.length - 1;
            receivers[r_index] = {marker: null, infobox: null};
        }

        var receiver = receivers[r_index];
        receiver.name = r[i].name;
        receiver.lat = lat;
        receiver.lon = lon;
        receiver.alt = parseFloat(r[i].alt);
        receiver.description = "<font style='font-size: 13px'>"+r[i].name+"</font><br/>" + r[i].description.replace("><BR>\n<","><").replace("ago<BR>\n<","ago<");
        receiver.fresh = true;

        updateReceiverMarker(receiver);
    }

    // clear old receivers
    var i = 0;
    for(; i < receivers.length;) {
        var e = receivers[i];
        if(e.fresh) {
            e.fresh = false;
            i++;
        }
        else {
            // close box, remove event handle, and remove marker
            e.infobox.close();
            e.infobox_handle.remove();
            e.marker.setMap(null);

            // remove from arrays
            receivers.splice(i,1);
            receiver_names.splice(i,1);
        }
    }
}

function updatePredictions(r) {
    if(!r) return;
    ls_pred = true;

    var i = 0, ii = r.length;
    for(; i < ii; i++) {
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

    mapInfoBox.close();
    if(follow_vehicle > -1) update_lookangles(follow_vehicle);
}

var status = "";
var bs_idx = 0;

function update(response) {
    if (response == null
            || !response.positions
            || !response.positions.position
            || !response.positions.position.length) {
        return;
    }

    // create a dummy response object for postions
    var lastPositions = { positions: { position: [] } };
    var ctx_init = {
        positions: response.positions.position,
        lastPositions: lastPositions,
        lastPPointer: lastPositions.positions.position,
        idx: 0,
        max: response.positions.position.length,
        last_vehicle: null,
        step: function(ctx) {
            var draw_idx = -1;

            var i = ctx.idx;
            var max = i + 5000;
            max = (max >= ctx.max) ? ctx.max : max;

            for (; i < max ; i++) {
                var row = ctx.positions[i];

                if(row.position_id > position_id) { position_id = row.position_id; }

                if (!row.picture) {
                    if(ctx.last_vehicle == null) ctx.last_vehicle = row.vehicle;

                    addPosition(row);
                    got_positions = true;

                    if(ctx.last_vehicle != row.vehicle) {
                        draw_idx = vehicle_names.indexOf(ctx.last_vehicle);
                        ctx.last_vehicle = row.vehicle;
                    }
                }
            }

            ctx.idx = max;

            if(ctx.idx < ctx.max) {
              setTimeout(function() { ctx.step(ctx); }, 4);
            } else {
              ctx.idx = 0;
              ctx.max = vehicle_names.length;
              setTimeout(function() { ctx.draw(ctx); }, 16);
            }
        },
        draw: function(ctx) {
            if(vehicles[ctx.idx].updated) {
                updatePolyline(ctx.idx);
                updateVehicleInfo(ctx.idx, vehicles[ctx.idx].curr_position);

                // remember last position for each vehicle
                ctx.lastPPointer.push(vehicles[ctx.idx].curr_position);

                if(listScroll) listScroll.refresh();
                if(zoomed_in && follow_vehicle == ctx.idx) panTo(follow_vehicle);
            }

            ctx.idx++;

            if(ctx.idx < ctx.max) {
              setTimeout(function() { ctx.draw(ctx); }, 16);
            } else {
              setTimeout(function() { ctx.end(ctx); }, 16);
            }
        },
        end: function(ctx) {
          // update graph is current vehicles is followed
          if(follow_vehicle != -1 && vehicles[follow_vehicle].graph_data_updated) updateGraph(follow_vehicle, false);

          // store in localStorage
          offline.set('positions', ctx.lastPositions);

          if (got_positions && !zoomed_in && vehicles.length) {
              zoom_on_payload();
              zoomed_in = true;
          }
        }
    }

    ctx_init.step(ctx_init);
}

function zoom_on_payload() {
    // find a the first balloon
    var i = -1, ii = vehicles.length;
    while(++i < ii) if(vehicles[i].vehicle_type == "balloon") break;

    if(i == ii) return;
    else {
        // find the bounds of the ballons first and last positions
        var bounds = new google.maps.LatLngBounds();
        bounds.extend(vehicles[i].positions[0]);
        bounds.extend(vehicles[i].positions[vehicles[i].positions.length - 1]);

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
