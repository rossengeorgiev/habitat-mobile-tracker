var mission_id = 0;
var position_id = 0;
var data_url = "//spacenear.us/tracker/datanew.php";
var receivers_url = "//spacenear.us/tracker/receivers.php";
var predictions_url = "//spacenear.us/tracker/get_predictions.php?vehicles=";

var habitat_max = 400;
//var habitat_url = "//habitat.habhub.org/habitat/";
var habitat_url = "/habitat/";
var habitat_url_payload_telemetry = habitat_url + "_design/payload_telemetry/_view/payload_time?startkey=[%22{ID}%22,{START}]&endkey=[%22{ID}%22,{END}]&include_docs=true&limit=" + habitat_max + "&skip=";

var host_url = "";
var markers_url = "img/markers/";
var vehicles = {};
var elm_uuid = 0;

var receiver_names = [];
var receivers = [];

var got_positions = false;
var zoomed_in = false;
var max_positions = 0; // maximum number of positions that ajax request should return (0 means no maximum)
var follow_vehicle = null;
var graph_vehicle = null;
var manual_pan = false;

var car_index = 0;
var car_colors = ["blue", "red", "green", "yellow"];
var balloon_index = 0;
var balloon_colors_name = ["red", "blue", "green", "yellow", "purple", "orange", "cyan"];
var balloon_colors = ["#f00", "blue", "green", "#FDFC30", "#c700e6", "#ff8a0f", "#0fffca"];

var nyan_color_index = 0;
var nyan_colors = ['nyan', 'nyan-coin', 'nyan-mon', 'nyan-pirate', 'nyan-cool', 'nyan-tothemax', 'nyan-pumpkin', 'nyan-afro', 'nyan-coin', 'nyan-mummy'];
var rainbow = ["#ff0000", "#fc9a00", "#f6ff00", "#38ff01", "#009aff","#0000ff"];

var map = null;
var overlay = null;
var layer_clouds = null;

var notamOverlay = null;

var modeList = [
//    "Position",
    "1 hour",
    "6 hours",
    "12 hours",
    "1 day",
    "3 days",
    "All",
];
var modeDefault = "1 day";
var modeDefaultMobile = "1 hour";

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
var plot_holder = "#telemetry_graph .holder";
var plot_options = {
    crosshair: {
        mode: "x"
    },
    legend: {
        show: true,
        sorted: false,
        position: 'nw',
        noColumns: 1,
        backgroundColor: null,
        backgroundOpacity: 0
    },
    grid: {
        show: true,
        hoverable: true,
        aboveData: true,
        borderWidth: 0,
    },
    selection: {
        mode: "x"
    },
    yaxes: [
        {show: false, min: 0, max: 0},
        {show: false, min: 0, max: 0},
        {show: false, min: 0 },
        {show: false, min: 0 },
        {show: false, min: 0 },
        {show: false, min: 0 },
        {show: false, min: 0 },
        {show: false, min: 0 },
        {show: false, min: 0 },
    ],
    xaxes: [
        {
            show: true,
            mode: "time",
            timeformat: "%m/%d %H:%M"
        }
    ]
};

// aprs overlay
var overlayAPRS = new google.maps.ImageMapType({
    getTileUrl: function(coord, zoom) {
        var n = Math.pow(2,zoom);
        return (coord.y<0 || coord.y>=n || zoom > 6) ? null : "http://" +
                                                              ['a','b','c'][Math.abs(coord.x+coord.y)%3] +
                                                              ".tiles.tracker.habhub.org/aprs/tile_" +
                                                              zoom + "_" +
                                                              wrapTiles(coord.x,zoom) + "_" +
                                                              coord.y + ".png";
    },
    tileSize: new google.maps.Size(256,256)
});

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
    var great_circle_distance = angle_at_centre * EARTH_RADIUS;

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
    };
}

function update_lookangles(vcallsign) {
    if(GPS_ts === null) { return; }
    else if($("#lookanglesbox span").first().is(":hidden")) {
        $("#lookanglesbox div").hide().parent().find("span").show();
    }

    var a = {lat: GPS_lat, lon: GPS_lon, alt: GPS_alt};

    var xref = vehicles[vcallsign].curr_position;
    var b = {lat: parseFloat(xref.gps_lat), lon: parseFloat(xref.gps_lon), alt: parseFloat(xref.gps_alt)};

    var look = calculate_lookangles(a,b);

    $("#lookanglesbox .azimuth").text("Azimuth: " + roundNumber(look.azimuth, 2) + "°");
    $("#lookanglesbox .bearing").text(look.bearing);
    $("#lookanglesbox .elevation").text("Elevation: " + roundNumber(look.elevation, 2) + "°");

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
      if ((x & mask) !== 0) cell++;
      if ((y & mask) !== 0) cell += 2;
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
        'Ord. Survey',
        'Bing.com & Ordnance Survey',
         10,
         17,
         function(xy,z) { return 'http://ecn.t'+((Math.abs(xy.x+xy.y)%3)+1)+'.tiles.virtualearth.net/tiles/r'+makeQuad(xy.x, xy.y, z)+'?g=3483&productSet=mmOS&key=AhN7I60Jff9-gQEnDk6CORUyr66zjb5LFc0zS0KPsEIfaDRAVVIeDvk1H6jUx25l'; }
    ],
    osm: [
        'OSM',
        'OpenStreetMaps.org',
         1,
         19,
         function(xy,z) { var n = Math.pow(2,z); return (xy.y<0 || xy.y>=n) ? null : 'http://'+['a','b','c'][Math.abs(xy.x+xy.y)%3]+'.tile.openstreetmap.org/'+z+'/'+wrapTiles(xy.x,z)+'/'+xy.y+'.png'; }
    ],
    dark_matter: [
        'Dark Matter',
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
         1,
         19,
         function(xy,z) { var n = Math.pow(2,z); return (xy.y<0 || xy.y>=n) ? null : 'http://'+['a','b','c'][Math.abs(xy.x+xy.y)%3]+'.basemaps.cartocdn.com/dark_all/'+z+'/'+wrapTiles(xy.x,z)+'/'+xy.y+'.png'; }
    ],
    osm_toner: [
        'Toner',
        'Stamen.org Toner',
         1,
         18,
         function(xy,z) { var n = Math.pow(2,z); return (xy.y<0 || xy.y>=n) ? null : 'http://'+['a','b','c','d'][Math.abs(xy.x+xy.y)%4]+'.tile.stamen.com/toner/'+z+'/'+wrapTiles(xy.x,z)+'/'+xy.y+'.png'; }
    ],
    osm_watercolor: [
        'Watercolor',
        'Stamen.org Watercolor',
         1,
         18,
         function(xy,z) { var n = Math.pow(2,z); return (xy.y<0 || xy.y>=n) ? null : 'http://'+['a','b','c','d'][Math.abs(xy.x+xy.y)%4]+'.tile.stamen.com/watercolor/'+z+'/'+wrapTiles(xy.x,z)+'/'+xy.y+'.png'; }
    ]
};

// generate a list of names for the UI
var maptype_ids = ["roadmap","satellite","terrain"];
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
        }
    } else {
        mthrottle_last.time = now;
        mthrottle_last.x    = event.clientX;
        mthrottle_last.y    = event.clientY;
    }
}


function clean_refresh(text, force, history_step) {
    force = !!force;
    history_step = !!history_step;

    if(text == wvar.mode && !force) return false;
    if(ajax_inprogress) return false;

    stopAjax();

    // reset mode if, invalid mode is specified
    if(modeList.indexOf(text) == -1) text = (is_mobile) ? modeDefaultMobile : modeDefault;

    wvar.mode = text;
    tmpC.select(text);

    position_id = 0;

    mapInfoBox.close();

    // clear vehicles
    var callsign;
    for(callsign in vehicles) {
        removePrediction(callsign);
        vehicles[callsign].kill();
    }

    // clear hysplit
    for(callsign in hysplit) {
        hysplit[callsign].setMap(null);
    }

    car_index = 0;
    balloon_index = 0;
    nyan_color_index = 0;
    stopFollow(force);

    // add loading spinner in the vehicle list
    $('#main .empty').parent().remove();
    $("#main .portrait,#main .landscape").append(
        '<div class="row vehicle'+elm_uuid+'"><div class="header empty">' +
        '<img style="width:90px;height:30px" src="img/hab-spinner.gif"/></div></div>'
    );
    listScroll.refresh();

    lhash_update(history_step);

    clearTimeout(periodical);
    clearTimeout(periodical_receivers);

    refresh();

    return true;
}

var tmpC;

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
        gestureHandling: 'greedy',
        keyboardShortcuts: false,
        streetViewControl: false,
        rotateControl: false,
        panControl: false,
        scaleControl: true,
        zoomControl: true,
        zoomControlOptions: {
            style: google.maps.ZoomControlStyle.DEFAULT
        },
        fullscreenControl: true,
        fullscreenControlOptions: {
            position: google.maps.ControlPosition.LEFT_BOTTOM
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

    var customTileAttr = new google.maps.StatusTextControl({
        text: '',
        map: map,
        position: google.maps.ControlPosition.BOTTOM_RIGHT,
    });

    google.maps.event.addListener(map, 'maptypeid_changed', function() {
        var id = this.getMapTypeId();
        customTileAttr.setText((id in maptypes) ? maptypes[id][1] : '');
    });

    // update current position if we geolocation is available
    if(currentPosition) updateCurrentPosition(currentPosition.lat, currentPosition.lon);

    // initalize nite overlay
    nite.init(map);
    if(!offline.get('opt_daylight')) nite.hide();
    setInterval(function() { nite.refresh(); }, 30000); // 30s

    // we need a dummy overlay to access getProjection()
    overlay = new google.maps.OverlayView();
    overlay.draw = function() {};
    overlay.setMap(map);

    // status message boxes
    var statusElm = new google.maps.StatusTextControl({
        map: map,
        position: google.maps.ControlPosition.RIGHT_BOTTOM,
        text: "<span id='stText'></span><span> Updated: </span><i class='friendly-dtime' id='stTimer'>never</i>"
    });


    google.maps.event.addListener(map, 'zoom_changed', function() {
        updateZoom();
    });

    google.maps.event.addListener(map, 'dragstart', function() {
        if(!wvar.embeded) manual_pan = true;
    });

    // only start population the map, once its completely loaded
    google.maps.event.addListenerOnce(map, 'idle', function(){
        load_hash(null);

        // initialize period menu
        tmpC = new google.maps.DropDownControl({
            map: map,
            title: "Show activity for given period",
            //position: google.maps.ControlPosition.TOP_RIGHT,
            position: google.maps.ControlPosition.LEFT_TOP,
            headerPrefix: "Last: ",
            list: modeList,
            listDefault: modeList.indexOf(wvar.mode),
            callback: clean_refresh,
        });

        google.maps.event.addListener(map, 'idle', function() {
            lhash_update();
        });
        google.maps.event.addListener(map, 'maptypeid_changed', function() {
            lhash_update();
        });

        startAjax();
    });

    // animate-in the timebox,
    setTimeout(function() {
        var elm = $("#timebox");

        //if(is_mobile) $(".slickbox").css({left:'5px'});
        var origW = elm.width();
        var iconW = elm.find("svg").width();

        if(offline.get('opt_hide_timebox')) {
            elm.removeClass('animate').hide();
            $("#lookanglesbox").css({top:'7px'});
        }

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
          if(GPS_ts === null) {
              $("#lookanglesbox .nopos").fadeIn(500, "easeOut");
          } else if($("#lookanglesbox span:first").is(":hidden")) {
              $("#lookanglesbox .nofollow").fadeIn(500, "easeOut");
          }
        });

        // if we there is enough screen space open aboutbox on startup
        if(!is_mobile && !offline.get('opt_nowelcome') && $(window).width() > 900) $('.nav li.about').click();

    }, 500);

    // load if aprs layer, if selected
    if(offline.get('opt_layers_aprs')) map.overlayMapTypes.setAt("1", overlayAPRS);
}

function panTo(vcallsign) {
    if(!vcallsign || vehicles[vcallsign] === undefined) return;

    // update lookangles
    update_lookangles(vcallsign);

    // pan map
    //if(vehicles[vcallsign].marker_shadow) map.panTo(vehicles[vcallsign].marker_shadow.getPosition());
    //else map.panTo(vehicles[vcallsign].marker.getPosition());
    map.panTo(vehicles[vcallsign].marker.getPosition());
}

function title_case(s) {
  return s.replace(/\w\S*/g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

function guess_name(key) {
  return title_case(key.replace(/_/g, " "));
}

function habitat_data(jsondata, alternative) {
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
    "pred_lat": "Onboard Prediction (Lat)",
    "pred_lon": "Onboard Prediction (Lon)"
  };

  var hide_keys = {
    "spam": true,
    "battery_millivolts": true,
    "temperature_internal_x10": true,
    "uplink_rssi_raw": true
  };

  var suffixes = {
    "current": " A",
    "battery": " V",
    "solar_panel": " V",
    "temperature": "&deg;C",
    "temperature_internal": "&deg;C",
    "temperature_external": "&deg;C",
    "temperature_radio": "&deg;C",
    "pressure": " Pa",
    "voltage_solar_1": " V",
    "voltage_solar_2": " V",
    "battery_percent": "%",
    "uplink_rssi": " dBm",
    "rssi_last_message": " dBm",
    "rssi_floor": " dBm",
    "bearing": "&deg;",
    "iss_azimuth": "&deg;",
    "iss_elevation": "&deg;",
    "light_intensity": " lx",
    "spam": ""
  };

  try
  {
    if (jsondata === undefined || jsondata === null) return "";

    var data = (typeof jsondata === "string") ? $.parseJSON(jsondata) : jsondata;
    var array = [];
    var output = "";

    if(Object.keys(data).length === 0) return "";

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
        suffix = suffixes[k];

      if (typeof v === "string") {
        v = v.replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
      }

      if(typeof alternative == 'boolean' && alternative) {
          output += "<div><b>" + name + ":&nbsp;</b>" + v + suffix + "</div>";
      } else {
          output += "<dt>" + v + suffix + "</dt><dd>" + name + "</dd>";
      }
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

function updateAltitude(vcallsign) {
  var pixel_altitude = 0;
  var zoom = map.getZoom();
  var vehicle = vehicles[vcallsign];
  var position = vehicle.curr_position;

  if(vehicle.marker.mode == 'landed') {
      vehicle.marker.setPosition(vehicle.marker.getPosition());
      return;
  }

  if(zoom > 18) zoom = 18;
  if(position.gps_alt > 0) {
    pixel_altitude = Math.round(position.gps_alt/(1000/3)*(zoom/18.0));
  }
  if(position.vehicle.toLowerCase().indexOf("iss") != -1) {
    pixel_altitude = Math.round(40000/(1000/3)*(zoom/18.0));
  } else if(position.gps_alt > 55000) {
    position.gps_alt = 55000;
  }
  vehicle.marker.setAltitude(pixel_altitude);
}

function updateZoom() {
    for(var vcallsign in vehicles) {
        var vehicle = vehicles[vcallsign];

        if(vehicle.vehicle_type == "balloon") {
          updateAltitude(vcallsign);
        } else {
            vehicle.marker.setPosition(vehicle.marker.getPosition());
        }

        if(vehicle.marker_shadow)
            vehicle.marker_shadow.setPosition(vehicle.marker_shadow.getPosition());
    }
}

var los_polylines = [];

function drawLOSPaths(vcallsign) {
    los_polylines.forEach(function(polyline) {
        polyline.setMap(null);
    });
    los_polylines = [];

    if(offline.get('opt_hide_receivers')) return;

    var vehicle = vehicles[vcallsign];

    if(vehicle === undefined || vehicle.vehicle_type !== "balloon") return;

    var callsigns = vehicle.curr_position.callsign.split(',');

    callsigns.forEach(function(callsign) {
        callsign = callsign.trim(' ');

        var r_index = receiver_names.indexOf(callsign);

        if(r_index === -1) return;

        var path = [
            vehicle.marker_shadow.getPosition(),
            receivers[r_index].marker.getPosition(),
        ];

        var p = new google.maps.Polyline({
            map: map,
            path: path,
            zIndex: Z_PATH,
            strokeColor: '#0F0',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            clickable: true,
            draggable: false,
            geodesic: true
        });
        p.path_length = google.maps.geometry.spherical.computeDistanceBetween(path[0], path[1]);
        los_polylines.push(p);
        google.maps.event.addListener(p, 'click', mapInfoBox_handle_prediction_path);
    });
}

function focusVehicle(vcallsign, ignoreOpt) {
    if(!offline.get('opt_hilight_vehicle') && ignoreOpt === undefined) return;

    var opacityFocused = 1;
    var opacityOther = 0.1;

    for(var i in vehicles) {
        var vehicle = vehicles[i], j;

        if(i == vcallsign || vcallsign === null) {
            if(vehicle.horizon_circle) vehicle.horizon_circle.setOptions({zIndex:Z_RANGE,strokeOpacity:opacityFocused * 0.6});
            if(vehicle.subhorizon_circle) vehicle.subhorizon_circle.setOptions({zIndex:Z_RANGE,strokeOpacity:opacityFocused * 0.8});
            for(j in vehicle.polyline) vehicle.polyline[j].setOptions({zIndex:Z_PATH-j,strokeOpacity:opacityFocused});
        }
        else {
            if(vehicle.horizon_circle) vehicle.horizon_circle.setOptions({zIndex:1,strokeOpacity:opacityOther * 0.6});
            if(vehicle.subhorizon_circle) vehicle.subhorizon_circle.setOptions({zIndex:1,strokeOpacity:opacityOther * 0.8});
            for(j in vehicle.polyline) vehicle.polyline[j].setOptions({zIndex:1,strokeOpacity:opacityOther});
        }
    }
}

function stopFollow(no_data_reset) {
    no_data_reset = !!no_data_reset;

	if(follow_vehicle !== null) {
        if(!no_data_reset) {
            focusVehicle(null);

            // remove target mark
            $("#main .row.follow").removeClass("follow");

            if(follow_vehicle in vehicles) vehicles[follow_vehicle].follow = false;
            follow_vehicle = null;
            graph_vehicle = null;
            wvar.focus = "";
        }

        // clear graph
        if(plot) plot = $.plot(plot_holder, {}, plot_options);
        updateGraph(null, true);

        // clear LOS lines
        drawLOSPaths(null);

        // update lookangles box
        if(GPS_ts !== null) $("#lookanglesbox span").hide().parent().find(".nofollow").show();

        lhash_update();
    }
}

function followVehicle(vcallsign, noPan, force) {
    var should_pan = !noPan;
    force = !!force;

    if(vcallsign === null) { stopFollow(); return; }

	if(vehicles.hasOwnProperty(follow_vehicle)) {
        vehicles[follow_vehicle].follow = false;
    }

	if(!vehicles.hasOwnProperty(vcallsign)) {
        return;
    }

    if(follow_vehicle != vcallsign || force) {
        focusVehicle(vcallsign);

		follow_vehicle = vcallsign;
		vehicles[follow_vehicle].follow = true;

        // add target mark
        $("#main .row.follow").removeClass("follow");
        $("#main .vehicle"+vehicles[vcallsign].uuid).addClass("follow");

        updateGraph(vcallsign, true);
        drawLOSPaths(vcallsign);
	}

    if(should_pan) {
        manual_pan = false;
        panTo(vcallsign);
    }

    lhash_update();
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
        return a+'-'+b+'-'+c+'&nbsp;'+e+':'+f+':'+g+"&nbsp;UTC"+((z<0)?"-":"+")+z;
    } else {
        return a+'-'+b+'-'+c+'&nbsp;'+e+':'+f+':'+g;
    }
}

function updateVehicleInfo(vcallsign, newPosition) {
  var vehicle = vehicles[vcallsign];
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

  if(!!vehicle.marker.setCourse) vehicle.marker.setCourse((vehicle.curr_position.gps_heading !== "") ? parseInt(vehicle.curr_position.gps_heading) : 90);

  // update horizon circles and icon
  if(vehicle.vehicle_type == "balloon") {
    updateAltitude(vcallsign);
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
                     vehicle.max_alt > 1500 &&      // if it has gone up
                     vehicle.ascent_rate < 1.0 &&   // and has negative ascent_rate, aka is descending
                     newPosition.gps_alt < 350      // and is under 350 meters altitude
                 ) || (                             // or
                     newPosition.gps_alt < 600 &&   // under 600m and has no position update for more than 30 minutes
                     (new Date().getTime() - convert_time(newPosition.gps_time)) > 1800000
                 );

    if(landed) {
        vehicle.marker.setMode("landed");
    } else if(vehicle.ascent_rate > -3.0) {
        vehicle.marker.setMode("balloon");
    } else {
        vehicle.marker.setMode("parachute");
    }

    // Update landing marker if data is available
    if (newPosition.data.hasOwnProperty("pred_lat") && newPosition.data.hasOwnProperty("pred_lon")){
        // Landing prediction data exists..
        if (vehicle.landing_marker !== null){
            // We already have a marker initialized.
            if(newPosition.gps_alt > 350){
                // Balloon is still in flight, so update the marker.
                vehicle.landing_marker.setPosition(new google.maps.LatLng(newPosition.data.pred_lat, newPosition.data.pred_lon));
                // Re-add to map if it's been removed previously.
                if (vehicle.landing_marker.getMap() == null){
                    vehicle.landing_marker.setMap(map);
                }
            }else{
                // Balloon has landed, so hide the marker.
                // Should we do this? Can we re-add it safely?
                vehicle.landing_marker.setMap(null);
            }
        } else{
            // Landing marker has not been initialised yet.
            if((newPosition.data.pred_lat !== 0.0) && (newPosition.data.pred_lon !== 0.0)){

                landing_image_src = host_url + markers_url + "balloon-xmark.png";
                landing_image_src_size = new google.maps.Size(48,38);
                landing_image_src_offset = new google.maps.Point(0,-38);

                landing_marker = new google.maps.Marker({
                    icon: {
                        url: landing_image_src,
                        size: landing_image_src_size,
                        scaledSize: landing_image_src_size,
                        anchor: new google.maps.Point(24,18)
                    },
                    zIndex: Z_CAR,
                    position: new google.maps.LatLng(position.data.pred_lat, position.data.pred_lon),
                    map: map,
                    optimized: false,
                    title: vcallsign + " Onboard Landing Prediction"
                });

                // Add the marker to the map, and to the vehicle object.
                landing_marker.setMap(map);
                vehicle.landing_marker = landing_marker;
            }

        }
    }
  }

  var image = vehicle.image_src;
  var elm = $('.vehicle' + vehicle.uuid);

  // if the vehicle doesn't exist in the list
  if (elm.length === 0) {
    $('.portrait').append('<div class="row vehicle'+vehicle.uuid+'" data-vcallsign="'+vcallsign+'"></div>');
    $('.landscape').append('<div class="row vehicle'+vehicle.uuid+'" data-vcallsign="'+vcallsign+'"></div>');

  } else if(elm.attr('data-vcallsign') === undefined) {
    elm.attr('data-vcallsign', vcallsign);
  }

  // decides how to dispaly the horizonal speed
  var imp = offline.get('opt_imperial'), hrate_text;
  var ascent_text = imp ? (vehicle.ascent_rate * 196.850394).toFixed(1) + ' ft/min' : vehicle.ascent_rate.toFixed(1) + ' m/s';
  if (offline.get('opt_haxis_hours')) {
          hrate_text = imp ? (vehicle.horizontal_rate * 2.23693629).toFixed(1) + ' mph' : (vehicle.horizontal_rate * 3.6).toFixed(1) + ' km/h';
  } else {
          hrate_text = imp ? (vehicle.horizontal_rate * 196.850394).toFixed(1) + ' ft/min' : vehicle.horizontal_rate.toFixed(1) + ' m/s';
  }

  var coords_text;
  var ua =  navigator.userAgent.toLowerCase();

  // determine how to link the vehicle coordinates to a native app, if on a mobile device
  if(ua.indexOf('iphone') > -1) {
      coords_text = '<a id="launch_mapapp" href="maps://?q='+newPosition.gps_lat+','+newPosition.gps_lon+'">' +
                    roundNumber(newPosition.gps_lat, 5) + ', ' + roundNumber(newPosition.gps_lon, 5) +'</a>' +
                    ' <i class="icon-location"></i>';
  } else if(ua.indexOf('android') > -1) {
      coords_text = '<a id="launch_mapapp" href="geo:'+newPosition.gps_lat+','+newPosition.gps_lon+'?q='+newPosition.gps_lat+','+newPosition.gps_lon+'('+vcallsign+')">' +
                    roundNumber(newPosition.gps_lat, 5) + ', ' + roundNumber(newPosition.gps_lon, 5) +'</a>' +
                    ' <i class="icon-location"></i>';
  } else {
      coords_text = roundNumber(newPosition.gps_lat, 5) + ', ' + roundNumber(newPosition.gps_lon, 5);
  }

  // format altitude strings
  var text_alt      = Number((imp) ? Math.floor(3.2808399 * parseInt(newPosition.gps_alt)) : parseInt(newPosition.gps_alt)).toLocaleString("us");
      text_alt     += " " + ((imp) ? 'ft':'m');
  var text_alt_max  = Number((imp) ? Math.floor(3.2808399 * parseInt(vehicle.max_alt)) : parseInt(vehicle.max_alt)).toLocaleString("us");
      text_alt_max += " " + ((imp) ? 'ft':'m');


  // start
  var a    = '<div class="header">' +
           '<span>' + vcallsign + ' <i class="icon-target"></i></span>' +
           '<canvas class="graph"></canvas>' +
           '<i class="arrow"></i></div>' +
           '<div class="data">' +
           '<img class="'+((vehicle.vehicle_type=="car")?'car':'')+'" src="'+image+'" />' +
           '<span class="vbutton path '+((vehicle.polyline_visible) ? 'active' : '')+'" data-vcallsign="'+vcallsign+'"' +
               ' style="top:'+(vehicle.image_src_size.height+55)+'px">Path</span>' +
           ((vcallsign in hysplit) ? '<span class="vbutton hysplit '+((hysplit[vcallsign].getMap()) ? 'active' : '')+'"' +
                ' data-vcallsign="'+vcallsign+'" style="top:'+(vehicle.image_src_size.height+55+21+10)+'px">HYSPLIT</span>' : '') +
           ((vcallsign.substr(0, 6) in ssdv) ? '<a class="vbutton active" href="//ssdv.habhub.org/' + vcallsign.substr(0, 6) + '"' +
                ' target="_blank" style="top:'+(vehicle.image_src_size.height+55+((vcallsign in hysplit) ? 42 : 21)+10)+'px">SSDV</a>' : '') +
           '<div class="left">' +
           '<dl>';
  // end
  var b    = '</dl>' +
           '</div>' + // right
           '</div>' + // data
           '';
  var c    = '<dt class="receivers">Received <i class="friendly-dtime" data-timestamp='+(convert_time(newPosition.server_time))+'></i> via:</dt><dd class="receivers">' +
           newPosition.callsign.split(",").join(", ") + '</dd>';

  if(!newPosition.callsign) c = '';


  // mid for portrait
  var p    = '<dt>'+formatDate(stringToDateUTC(newPosition.gps_time))+'</dt><dd>datetime (local)</dd>' +
           '<dt>'+coords_text+'</dt><dd>coordinates</dd>' +
           c +// receivers if any
           '</dl>' +
           '</div>' + // left
           '<div class="right">' +
           '<dl>' +
           ((vehicle.vehicle_type == "car") ? '' : '<dt>'+ascent_text+'<br/>'+hrate_text+'</dt><dd>rate v|h</dd>') +
           '<dt>'+text_alt+'</dt><dd>altitude</dd>' +
           '<dt>'+text_alt_max+'</dt><dd>max alt</dd>' +
           '';
  // mid for landscape
  var l    = ((vehicle.vehicle_type == "car") ? '' : '<dt>'+ascent_text+' '+hrate_text+'</dt><dd>rate v|h</dd>') +
           '<dt>'+text_alt+' ('+text_alt_max+')</dt><dd>altitude (max)</dd>' +
           '<dt>'+formatDate(stringToDateUTC(newPosition.gps_time))+'</dt><dd>datetime (local)</dd>' +
           '<dt>'+coords_text+'</dt><dd>coordinates</dd>' +
           habitat_data(newPosition.data) +
           c + // receivers if any
           '';

  // update html
  $('.portrait .vehicle'+vehicle.uuid).html(a + p + b);
  $('.landscape .vehicle'+vehicle.uuid).html(a + l + b);

  // redraw canvas
  if(wvar.mode != "Position" && vehicle.graph_data.length) {
      var can = $('.vehicle'+vehicle.uuid+' .graph');
      drawAltitudeProfile(can.get(0), can.get(1), vehicle.graph_data[0], vehicle.max_alt);
  }

  // mark vehicles as redrawn
  vehicle.updated = false;

  return true;
}

function set_polyline_visibility(vcallsign, val) {
    var vehicle = vehicles[vcallsign];
    vehicle.polyline_visible = val;

    for(var k in vehicle.polyline) vehicle.polyline[k].setVisible(val);

    mapInfoBox.close();
}

function removePrediction(vcallsign) {
  if(vehicles[vcallsign].prediction_polyline) {
    vehicles[vcallsign].prediction_polyline.setMap(null);
    vehicles[vcallsign].prediction_polyline = null;
  }
  if(vehicles[vcallsign].prediction_target) {
    vehicles[vcallsign].prediction_target.setMap(null);
    vehicles[vcallsign].prediction_target = null;
  }
  if(vehicles[vcallsign].prediction_burst) {
    vehicles[vcallsign].prediction_burst.setMap(null);
    vehicles[vcallsign].prediction_burst = null;
  }
}

function redrawPrediction(vcallsign) {
    var vehicle = vehicles[vcallsign];
	var data = vehicle.prediction.data;
	if(data.warnings || data.errors) return;

    var line = [];
    var graph_data = [];
    var latlng = null;
    var max_alt = -99999;
    var latlng_burst = null;
    var	burst_index = 0;
    var path_length = 0;

    for(var i = 0, ii = data.length; i < ii; i++) {
        latlng = new google.maps.LatLng(data[i].lat, data[i].lon);
        line.push(latlng);

        // pred.alt for graph
        var alt = parseInt(data[i].alt);
        graph_data.push([parseInt(data[i].time)*1000, alt]);
        // adjust y-range
        if(alt > vehicle.graph_yaxes[0].max) {
            vehicle.graph_yaxes[0].max = alt;
            vehicle.graph_yaxes[1].max = vehicle.graph_yaxes[0].max;
        }

        if(parseFloat(data[i].alt) > max_alt) {
            max_alt = parseFloat(data[i].alt);
            latlng_burst = latlng;
            burst_index = i;
        }
        if(i > 1) path_length += google.maps.geometry.spherical.computeDistanceBetween(line[i-1], line[i]);
    }

    vehicle.graph_data[1].data = graph_data;
    if(follow_vehicle !== null && follow_vehicle === vcallsign) updateGraph(vcallsign, true);
    vehicle.prediction_path = line;

    if(vehicle.prediction_polyline !== null) {
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
        google.maps.event.addListener(vehicle.prediction_polyline, 'click', mapInfoBox_handle_prediction_path);
    }

    vehicle.prediction_polyline.path_length = path_length;

    var image_src;
    if(vcallsign != "wb8elk2") { // WhiteStar
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

    if(burst_index !== 0 && vcallsign != "wb8elk2") {
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

function updatePolyline(vcallsign) {
    for(var k in vehicles[vcallsign].polyline) {
        vehicles[vcallsign].polyline[k].setPath(vehicles[vcallsign].positions);
    }
}

function drawAltitudeProfile(c1, c2, series, alt_max) {
    alt_max = (alt_max < 2000) ? 2000 : alt_max;
    var alt_list = series.data;
    var len = alt_list.length;
    var real_len = len - series.nulls;

    var ctx1 = c1.getContext("2d");
    var ctx2 = c2.getContext("2d");

    c1 = $(c1);
    c2 = $(c2);

    var ratio = window.devicePixelRatio;
    var cw1 = 180 * ratio;
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

    var xt1 = (cw1 - (2 * ratio)) / real_len;
    var yt1 = (ch1 - (6 * ratio)) / alt_max;
    var xt2 = (cw2 - (2 * ratio)) / real_len;
    var yt2 = (ch2 - (6 * ratio)) / alt_max;

    xt1 = (xt1 > 1) ? 1 : xt1;
    yt1 = (yt1 > 1) ? 1 : yt1;
    xt2 = (xt2 > 1) ? 1 : xt2;
    yt2 = (yt2 > 1) ? 1 : yt2;

    ctx1.beginPath();
    ctx2.beginPath();

    // start line at the ground, depending in the first altitude datum
    if(alt_list[0][1] < 2000) {
        ctx1.lineTo(0,ch1);
        ctx2.lineTo(0,ch2);
    }


    var i, alt;
    // draw all altitude points, if they are not too many
    if(cw1*2 > real_len) {
        for(i = 0; i < real_len; i++) {
            alt = alt_list[i][1];

            ctx1.lineTo(1+((i+1)*xt1), ch1 - (alt * yt1));
            ctx2.lineTo(1+((i+1)*xt2), ch2 - (alt * yt2));

            if(i+2 < len && alt_list[i+2][1] === null) i += 2;
        }
    }
    // if they are too many, downsample to keep the loop short
    else {
        xt1 = 0.5;
        xt2 = 0.16;
        var max = cw1 * 2;
        var step = (1.0*len) / max;

        for(i = 0; i < max; i++) {
            alt = alt_list[Math.floor(i*step)][1];
            if(alt === null) continue;

            ctx1.lineTo(1+((i+1)*xt1), ch1 - (alt * yt1));
            ctx2.lineTo(1+((i+1)*xt2), ch2 - (alt * yt2));
        }

        // fix index for fill
        i = len - 1;
    }

    ctx1.stroke();
    ctx2.stroke();

    // close the path, so it can be filled
    ctx1.lineTo(1+((i+1)*xt1), ch1);
    ctx2.lineTo(1+((i+1)*xt2), ch2);
    ctx1.lineTo(0,ch1);
    ctx2.lineTo(0,ch2);

    ctx1.closePath();
    ctx2.closePath();
    ctx1.fill();
    ctx2.fill();
}

// infobox
var mapInfoBox = new google.maps.InfoWindow({
    maxWidth: 260
});

var mapInfoBox_handle_prediction_path = function(event) {
    var value = this.path_length;

    if(offline.get('opt_imperial')) {
        value = Math.round(value*0.000621371192) + " miles";
    } else {
        value = Math.round(value/10)/100 + " km";
    }

    mapInfoBox.setContent("<pre><b>Length:</b> " + value  + "</pre>");
    mapInfoBox.setPosition(event.latLng);
    mapInfoBox.open(map);
};

var mapInfoBox_handle_path = function(event) {
    var vehicle = this.vehicle || vehicles[follow_vehicle];
    var target = event.latLng;
    var p = vehicle.positions;

    var p1_dist = 0;
    var p2_dist = google.maps.geometry.spherical.computeDistanceBetween(p[0], target);

    var mindiff = Number.MAX_VALUE;
    var minidx = 0;
    var dist, diff;

    // find the closest existing point to snap to
    for(var i = 1, ii = p.length; i < ii; i++ ) {
        p1_dist = p2_dist;
        p2_dist = google.maps.geometry.spherical.computeDistanceBetween(p[i], target);
        dist = google.maps.geometry.spherical.computeDistanceBetween(p[i], p[i-1]);
        diff = Math.abs(dist - (p1_dist + p2_dist));

        if(diff >= 0 && mindiff > diff) {
            mindiff = diff;
            minidx = i;
        }
    }

    p1_dist = google.maps.geometry.spherical.computeDistanceBetween(p[minidx-1], target);
    p2_dist = google.maps.geometry.spherical.computeDistanceBetween(p[minidx], target);

    var point = (p1_dist < p2_dist) ? p[minidx-1] : p[minidx];
    var id = (p1_dist < p2_dist) ? vehicle.positions_ids[minidx-1] : vehicle.positions_ids[minidx];

    mapInfoBox.setContent("<img style='width:60px;height:20px' src='img/hab-spinner.gif' />");
    mapInfoBox.setPosition(point);
    mapInfoBox.setMap(map);
    mapInfoBox.open(map);

    mapInfoBox_handle_path_fetch(id, vehicle);
};

var mapInfoBox_handle_path_fetch = function(id,vehicle) {
    var ishabitat = id.length == 64

    if(ishabitat) {
        var url = habitat_url + id;
    } else {
        var url = data_url + "?mode=single&format=json&position_id=" + id;
    }

    $.getJSON(url, function(data) {
        if(ishabitat) {
            var encap = {positions: { position: [] }};

            if(!data.hasOwnProperty('error')) {
                data._id = data._id.substring(58);
                encap.positions.position.push(habitat_doc_to_snus(data));
                data = encap;
            }
        }

        if('positions' in data && data.positions.position.length === 0) {
            mapInfoBox.setContent("not&nbsp;found");
            mapInfoBox.open(map);
            return;
        }

        data = data.positions.position[0];

        div = document.createElement('div');

        html = "<div style='line-height:16px;position:relative;'>";
        html += "<img style='position:absolute;top:"+vehicle.image_src_offset.y+"px;left:"+vehicle.image_src_offset.x+"px;" +
                "width:"+vehicle.image_src_size.width+"px;height:"+vehicle.image_src_size.height+"px'" +
                " src='"+vehicle.image_src+"' />";
        html += "<div>"+data.vehicle+"<span style='position:absolute;right:0px;'>("+data.position_id+")</span></div>";
        html += "<hr style='margin:5px 0px'>";
        html += "<div style='margin-bottom:5px;'><b><i class='icon-location'></i>&nbsp;</b>"+roundNumber(data.gps_lat, 5) + ',&nbsp;' + roundNumber(data.gps_lon, 5)+"</div>";

        var imp = offline.get('opt_imperial');
        var text_alt      = Number((imp) ? Math.floor(3.2808399 * parseInt(data.gps_alt)) : parseInt(data.gps_alt)).toLocaleString("us");
        text_alt     += "&nbsp;" + ((imp) ? 'ft':'m');

        html += "<div><b>Altitude:&nbsp;</b>"+text_alt+"</div>";
        html += "<div><b>Time:&nbsp;</b>"+formatDate(stringToDateUTC(data.gps_time))+"</div>";

        var value = vehicle.path_length;

        html += "<div><b>Distance:&nbsp;</b>";

        if(offline.get('opt_imperial')) {
            html += Math.round(value*0.000621371192) + "mi";
        } else {
            html += Math.round(value/10)/100 + "&nbsp;km";
        }

        html += "</div>";
        html += "<div><b>Duration:&nbsp;</b>" + format_time_friendly(vehicle.start_time, convert_time(vehicle.curr_position.gps_time)) + "</div>";

        if(Object.keys((typeof data.data === "string")?JSON.parse(data.data):data.data).length) {
            html += "<hr style='margin:5px 0px'>";
            html += habitat_data(data.data, true);
        }

        if(data.vehicle.search(/(chase)/i) == -1) {
            html += "<hr style='margin:0px;margin-top:5px'>";
            html += "<div style='font-size:11px;'><b>Received via:&nbsp;</b>"+data.callsign.replace(/,/g,', ')+"</div>";
        }

        div.innerHTML = html;

        mapInfoBox.setContent(div);
        mapInfoBox.open(map);

        setTimeout(function() {
            div.parentElement.style.overflow = "";
            div.parentElement.style.overflowWrap = "break-word";
        }, 16);
    });
};

var mapInfoBox_handle_prediction = function(event) {
    var data = this.pdata;
    var altitude;

    if(offline.get('opt_imperial')) {
        altitude = Math.round(alt*3.2808399) + " feet";
    } else {
        altitude = Math.round(data.alt) + " m";
    }

    mapInfoBox.setContent("<pre>" +
                        formatDate(new Date(parseInt(data.time) * 1000), true) + "\n\n" +
                        "<b>Altitude:</b> " + altitude + "\n" +
                        "<b>Latitude:</b> " + data.lat + "\n" +
                        "<b>Longtitude:</b> " + data.lon + "\n" +
                        "</pre>"
                        );
    mapInfoBox.setPosition(event.latLng);
    mapInfoBox.open(map);
};

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
};

var mapInfoBox_handle_truehorizon = function(event) { mapInfoBox_handle_horizons(event, this, "True Horizon"); };
var mapInfoBox_handle_horizon = function(event) { mapInfoBox_handle_horizons(event, this, "5° Horizon"); };

var icon_cache = {};
var marker_rotate_func = function(deg) {
    this.rotated = true;
    deg -= 90;
    deg += (deg < 0) ? 360 : 0;

    var radii = deg * DEG_TO_RAD;
    var img = this.iconImg;
    var len = Math.max(img.height, img.width)*1.2;
    var canvas = document.createElement('canvas');
    canvas.height = canvas.width = len;
    var ctx = canvas.getContext('2d');

    ctx.save();
    ctx.translate(len * 0.5, len * 0.5);
    ctx.rotate(radii);
    if(deg >= 90 && deg <= 270) ctx.scale(1,-1);
    ctx.drawImage(img, -img.width/2, -img.height*0.95);
    ctx.restore();

    var size = new google.maps.Size(canvas.width*0.5, canvas.height*0.5);
    this.setIcon({
        url: canvas.toDataURL(),
        size: size,
        scaledSize: size,
        anchor: new google.maps.Point(canvas.width*0.25, canvas.height*0.25)
    });
};

var marker_rotate_setup = function(marker, image_src) {
    marker.setCourse = marker_rotate_func;
    marker.rotated = false;
    if(image_src in icon_cache) {
        marker.iconImg = icon_cache[image_src];
        marker.setCourse(90);
        marker.setPosition(marker.getPosition());
    }
    else {
        marker.iconImg = new Image();
        icon_cache[image_src] = marker.iconImg;
        marker.iconImg.onload = function() {
            if(!marker.rotated) marker.setCourse(90);
            marker.setPosition(marker.getPosition());
        };
        marker.iconImg.src = image_src;
    }
};

var array_unique = function(inarr) {
    var seen = {};
    return inarr.filter(function(v) {
        return seen.hasOwnProperty(v) ? false : (seen[v] = true);
    });
};

function addPosition(position) {
    var vcallsign = position.vehicle;

    // check if the vehicle is already in the list, if not create a new item
    if(!vehicles.hasOwnProperty(vcallsign)) {
        var marker = null;
        var marker_shadow = null;
        var landing_marker = null;
        var vehicle_type = "";
        var horizon_circle = null;
        var subhorizon_circle = null;
        var point = new google.maps.LatLng(position.gps_lat, position.gps_lon);
        var image_src = "", image_src_size, image_src_offset;
        var color_index = 0;
        var gmaps_elements = [];
        var polyline = null;
        var polyline_visible = false;
        if(vcallsign.search(/(chase)/i) != -1) {
            vehicle_type = "car";
            color_index = car_index++ % car_colors.length;
            image_src = host_url + markers_url + "car-" + car_colors[color_index] + ".png";
            image_src_size = new google.maps.Size(55,25);
            image_src_offset = new google.maps.Point(0,-25);

            marker = new google.maps.Marker({
                zIndex: Z_CAR,
                position: point,
                map: map,
                clickable: false,
                optimized: false,
                title: vcallsign
            });

            if(!!!window.HTMLCanvasElement) {
                marker.setIcon({
                    url: image_src,
                    size: image_src_size,
                    scaledSize: image_src_size,
                    anchor: new google.maps.Point(27,22)
                });
            } else {
                marker_rotate_setup(marker, image_src);
            }
            gmaps_elements.push(marker);
            polyline = [
                new google.maps.Polyline({
                map: map,
                zIndex: Z_PATH,
                strokeColor: car_colors[color_index],
                strokeOpacity: 1,
                strokeWeight: 3,
                clickable: true,
                draggable: false,
                visible: polyline_visible,
                geodesic: true
                }),
            ];
        }
        else if(vcallsign == "XX") {
            vehicle_type = "xmark";
            image_src = host_url + markers_url + "balloon-xmark.png";
            image_src_size = new google.maps.Size(48,38);
            image_src_offset = new google.maps.Point(0,-38);

            marker = new google.maps.Marker({
                icon: {
                    url: image_src,
                    size: image_src_size,
                    scaledSize: image_src_size,
                    anchor: new google.maps.Point(24,18)
                },
                zIndex: Z_CAR,
                position: point,
                map: map,
                optimized: false,
                title: vcallsign
            });
            gmaps_elements.push(marker);
        } else {
            vehicle_type = "balloon";
            color_index = balloon_index++ % balloon_colors.length;

            image_src = host_url + markers_url + "balloon-" +
                        ((vcallsign == "PIE") ? "rpi" : balloon_colors_name[color_index]) + ".png";
            image_src_size = new google.maps.Size(46,84);
            image_src_offset = new google.maps.Point(-35,-46);

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
            gmaps_elements.push(marker_shadow);
            marker = new google.maps.Marker({
                map: map,
                optimized: false,
                zIndex: Z_PAYLOAD,
                position: point,
                icon: {
                    url: image_src,
                    size: image_src_size,
                    scaledSize: image_src_size,
                },
                title: vcallsign,
            });
            gmaps_elements.push(marker);
            marker.shadow = marker_shadow;
            marker.balloonColor = (vcallsign == "PIE") ? "rpi" : balloon_colors_name[color_index];
            marker.mode = 'balloon';
            marker.setMode = function(mode) {
                if(this.mode == mode) return;

                this.mode = mode;
                var img;
                if(mode == "landed") {
                    vehicle.marker.shadow.setVisible(false);
                    vehicle.horizon_circle.setVisible(false);
                    vehicle.horizon_circle.label.set('visible', false);
                    vehicle.subhorizon_circle.setVisible(false);
                    vehicle.subhorizon_circle.label.set('visible', false);

                    img = {
                        url: host_url + markers_url + "payload-" + this.balloonColor + ".png",
                        size: new google.maps.Size(17,18),
                        scaledSize: new google.maps.Size(17,18),
                        anchor: new google.maps.Point(8,14)
                    };
                } else {
                    vehicle.marker.shadow.setVisible(true);

                    if(offline.get('opt_hide_horizon') == false){
                        vehicle.horizon_circle.setVisible(true);
                        vehicle.horizon_circle.label.set('visible', true);
                        vehicle.subhorizon_circle.setVisible(true);
                        vehicle.subhorizon_circle.label.set('visible', true);
                    }

                    if(mode == "parachute") {
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
                }
                this.setIcon(img);
                this.setPosition(this.getPosition());
            };
            marker.setAltitude = function(alt) {
                var pos = overlay.getProjection().fromLatLngToDivPixel(this.shadow.getPosition());
                pos.y -= alt;
                this.setPosition(overlay.getProjection().fromDivPixelToLatLng(pos));
            };

            // Add landing marker if the payload provides a predicted landing position.
            if (position.data.hasOwnProperty('pred_lat') && position.data.hasOwnProperty('pred_lon')){
                // Only create the marker if the pred lat/lon are not zero (as will be the case during ascent).
                if ((position.data.pred_lat !== 0.0) && (position.data.pred_lon !== 0.0)){
                    landing_image_src = host_url + markers_url + "balloon-xmark.png";
                    landing_image_src_size = new google.maps.Size(48,38);
                    landing_image_src_offset = new google.maps.Point(0,-38);

                    landing_marker = new google.maps.Marker({
                        icon: {
                            url: landing_image_src,
                            size: landing_image_src_size,
                            scaledSize: landing_image_src_size,
                            anchor: new google.maps.Point(24,18)
                        },
                        zIndex: Z_CAR,
                        position: new google.maps.LatLng(position.data.pred_lat, position.data.pred_lon),
                        map: map,
                        optimized: false,
                        title: vcallsign + " Onboard Landing Prediction"
                    });
                    gmaps_elements.push(landing_marker);
                } else {
                    landing_marker = null;
                }
            } else {
                landing_marker = null;
            }

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
            gmaps_elements.push(horizon_circle);
            horizon_circle.bindTo('center', marker_shadow, 'position');

            // label
            horizon_circle.label = new google.maps.Label({
                map: map,
                strokeColor: horizon_circle.get('strokeColor'),
                visible: false
            });
            gmaps_elements.push(horizon_circle.label);
            horizon_circle.label.bindTo('opacity', horizon_circle, 'strokeOpacity');
            horizon_circle.label.bindTo('zIndex', horizon_circle, 'zIndex');
            horizon_circle.label.bindTo('strokeColor', horizon_circle, 'strokeColor');

            var refresh_func = function() {
                if(!this.getVisible()) {
                    this.label.set('visible', false);
                    return;
                }

                var north = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 0);
                var south = google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 180);

                var projection = this.label.getProjection();
                var dist = projection.fromLatLngToDivPixel(south).y -
                           projection.fromLatLngToDivPixel(north).y;

                var val = this.getRadius() / 1000;
                val = offline.get('opt_imperial') ? Math.round(val * 0.621371192) + "mi" : Math.round(val) + "km";

                this.label.set('visible', (75 < dist));
                this.label.set('position', google.maps.geometry.spherical.computeOffset(this.getCenter(), this.getRadius(), 180));
                this.label.set('text', val);
            };

            google.maps.event.addListener(horizon_circle, 'center_changed', refresh_func);
            google.maps.event.addListener(horizon_circle, 'radius_changed', refresh_func);

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
            gmaps_elements.push(subhorizon_circle);

            subhorizon_circle.label = new google.maps.Label({
                map: map,
                strokeColor: subhorizon_circle.get('strokeColor'),
                visible: false
            });
            gmaps_elements.push(subhorizon_circle.label);
            subhorizon_circle.label.bindTo('opacity', subhorizon_circle, 'strokeOpacity');
            subhorizon_circle.label.bindTo('zIndex', subhorizon_circle, 'zIndex');
            subhorizon_circle.label.bindTo('strokeColor', subhorizon_circle, 'strokeColor');

            google.maps.event.addListener(subhorizon_circle, 'center_changed', refresh_func);
            google.maps.event.addListener(subhorizon_circle, 'radius_changed', refresh_func);

            if(offline.get("opt_hide_horizon")){
                horizon_circle.setVisible(false);
                horizon_circle.label.set('visible', false);
                subhorizon_circle.setVisible(false);
                subhorizon_circle.label.set('visible', false);
            }

            marker.setAltitude(0);
            polyline_visible = true;
            polyline = [
                new google.maps.Polyline({
                map: map,
                zIndex: Z_PATH,
                strokeColor: balloon_colors[color_index],
                strokeOpacity: 1,
                strokeWeight: 3,
                clickable: true,
                draggable: false,
                visible: polyline_visible,
                geodesic: true
                }),
                new google.maps.Polyline({
                map: map,
                zIndex: Z_PATH - 1,
                strokeColor: (['cyan','yellow'].indexOf(balloon_colors_name[color_index]) > -1 ? '#888888' : "#ffffff"),
                strokeOpacity: 1,
                strokeWeight: 5,
                clickable: true,
                draggable: false,
                visible: polyline_visible,
                geodesic: true
                }),
            ];
        }

        // add label above every marker
        var mlabel = new google.maps.Label({map: map, textOnly: true, position: marker.getPosition() });
        gmaps_elements.push(mlabel);
        mlabel.bindTo('text', marker, 'title');
        mlabel.bindTo('zIndex', marker, 'zIndex');
        google.maps.event.addListener(marker, 'position_changed', function() {
            if(!!!marker.icon) return;

            var pos = mlabel.getProjection().fromLatLngToDivPixel(marker.getPosition());

            if(!!marker.iconImg) {
                pos.y -= marker.icon.size.height * 0.5 + 5;
            } else {
                pos.y -= marker.icon.size.height + 10;
            }

            mlabel.set('position',mlabel.getProjection().fromDivPixelToLatLng(pos));
        });
        marker._label = mlabel;
        marker.setPosition(marker.getPosition()); // activates the logic above to reposition the label

        var vehicle_info = {
                            callsign: vcallsign,
                            uuid: elm_uuid++,
                            vehicle_type: vehicle_type,
                            marker: marker,
                            marker_shadow: marker_shadow,
                            landing_marker: landing_marker,
                            image_src: image_src,
                            image_src_size: image_src_size,
                            image_src_offset: image_src_offset,
                            horizon_circle: horizon_circle,
                            subhorizon_circle: subhorizon_circle,
                            num_positions: 0,
                            positions: [],
                            positions_ts: [],
                            positions_ids: [],
                            path_length: 0,
                            curr_position: position,
                            line: [],
                            polyline_visible: polyline_visible,
                            polyline: polyline !== null ? polyline : [
                                new google.maps.Polyline({
                                map: map,
                                zIndex: Z_PATH,
                                strokeColor: "#ffffff",
                                strokeOpacity: 1,
                                strokeWeight: 3,
                                clickable: true,
                                draggable: false,
                                visible: polyline_visible,
                                geodesic: true
                                }),
                            ],
                            prediction: null,
                            prediction_polyline: null,
                            prediction_traget: null,
                            prediction_burst: null,
                            ascent_rate: 0.0,
                            horizontal_rate: 0.0,
                            max_alt: parseFloat(position.gps_alt),
                            follow: false,
                            color_index: color_index,
                            graph_data_updated: false,
                            graph_data_map: {},
                            graph_data: [],
                            graph_yaxes: [],
                            updated: false,
                            start_time: 2147483647000
                            };

        // deep copy yaxes config for graph
        plot_options.yaxes.forEach(function(v) { vehicle_info.graph_yaxes.push($.extend({}, v)); });

        // nyan mod
        if(wvar.nyan && vehicle_info.vehicle_type == "balloon") {
            // form a nyancat
            vehicle_info.marker.setMode = function(mode) { this.mode = mode; this.setPosition(this.getPosition()); };
            vehicle_info.marker.setAltitude = function(derp) { this.setPosition(this.getPosition()); };


            var nyan = nyan_colors[nyan_color_index] + ".gif";
            nyan_color_index = (nyan_color_index + 1) % nyan_colors.length;
            var nyanw = (nyan_color_index == 4) ? 104 : 55;

            vehicle_info.marker.setIcon({
                 url: host_url + markers_url + nyan,
                 size: new google.maps.Size(nyanw,39),
                 scaledSize: new google.maps.Size(nyanw,39),
                 anchor: new google.maps.Point(26,20)
             });
            vehicle_info.marker.iconImg = 1;

            vehicle_info.image_src = host_url + markers_url + "hab_nyan.gif";
            vehicle_info.image_src_offset = new google.maps.Point(-34,-70);

            // remove all polylines
            var k;
            for(k in vehicle_info.polyline) {
                vehicle_info.polyline[k].setMap(null);
            }

            vehicle_info.polyline = [];

            for(k in rainbow) {
                vehicle_info.polyline.push(new google.maps.Polyline({
                                map: map,
                                zIndex: (Z_PATH - (k * 1)),
                                strokeColor: rainbow[k],
                                strokeOpacity: 1,
                                strokeWeight: (k*4) + 2,
                                clickable: true,
                                draggable: false,
                                geodesic: true
                            }));
            }
        }

        vehicle_info.gmaps_elements = gmaps_elements.concat(vehicle_info.polyline);
        vehicle_info.kill = function() {
            $(".vehicle"+vehicle_info.uuid).remove();
            vehicle_info.gmaps_elements.forEach(function(elm) { elm.setMap(null); });
            delete vehicles[vehicle_info.callsign];
        };

        // polyline
        for(var pkey in vehicle_info.polyline) {
            vehicle_info.polyline[pkey].vehicle = vehicle_info;
            google.maps.event.addListener(vehicle_info.polyline[pkey], 'click', mapInfoBox_handle_path);
        }

        // horizon circles
        if(vehicle_info.horizon_circle) google.maps.event.addListener(vehicle_info.horizon_circle, 'click', mapInfoBox_handle_truehorizon);
        if(vehicle_info.subhorizon_circle) google.maps.event.addListener(vehicle_info.subhorizon_circle, 'click', mapInfoBox_handle_horizon);

        // let the nyan free
        vehicles[vcallsign] = vehicle_info;
    }

    var vehicle = vehicles[vcallsign];

    var new_latlng = new google.maps.LatLng(position.gps_lat, position.gps_lon);
    var new_ts = convert_time(position.gps_time);
    var curr_ts = convert_time(vehicle.curr_position.gps_time);
    var dt = (new_ts - curr_ts) / 1000; // convert to seconds

    if(dt === 0 && vehicle.num_positions) {
        var callsigns = vehicle.curr_position.callsign.split(', ');
        var newcalls = callsigns.concat(position.callsign.split(', '));

        vehicle.curr_position.callsign = array_unique(callsigns).join(', ');
    }
    else if(dt >= 0) {
        if(vehicle.num_positions > 0) {
            // calculate vertical rate
            var rate = (position.gps_alt - vehicle.curr_position.gps_alt) / dt;
            vehicle.ascent_rate = 0.7 * rate + 0.3 * vehicle.ascent_rate;

            // calculate horizontal rate
            vehicle.horizontal_rate = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(position.gps_lat, position.gps_lon),
                                                                                            new google.maps.LatLng(vehicle.curr_position.gps_lat, vehicle.curr_position.gps_lon)) / dt;
         }

        // add the new position
        if(wvar.mode == "Position") {
            vehicle.num_positions= 1;
            vehicle.positions[0] = new_latlng;
            vehicle.positions_ts[0] = new_ts;
        } else {
            vehicle.positions.push(new_latlng);
            vehicle.positions_ts.push(new_ts);
            vehicle.positions_ids.push(position.position_id);
            vehicle.num_positions++;
        }

        // increment length
        var poslen = vehicle.num_positions;
        if(poslen > 1) vehicle.path_length += google.maps.geometry.spherical.computeDistanceBetween(vehicle.positions[poslen-2], vehicle.positions[poslen-1]);

        // if car doesn't report heading, we calculate it from the last position
        if(vehicle.num_positions > 1 && vehicle.vehicle_type == 'car' && 'gps_heading' in position && position.gps_heading === "") {
            var latlng = new google.maps.LatLng(position.gps_lat, position.gps_lon);
            var old_latlng = new google.maps.LatLng(vehicle.curr_position.gps_lat, vehicle.curr_position.gps_lon);
            position.gps_heading = google.maps.geometry.spherical.computeHeading(old_latlng, latlng);
        }

        vehicle.curr_position = position;
        graphAddPosition(vcallsign, position);
    }
    else if(wvar.mode == "Position") { // we don't splice old postions in latest position mode
        return;
    }
    else {
        if(vehicle.positions_ts.indexOf(new_ts) > -1) return; // duplicate packet

        // backlog packets, need to splice them into the array
        // find out the index at which we should insert the new point
        var xref = vehicle.positions_ts;
        var idx = -1, len = xref.length;
        while(++idx < len) {
            if(xref[idx] > new_ts) {
                break;
            }
        }

        // recalculate the distance in the section where we insert
        if(idx === 0) {
            vehicle.path_length += google.maps.geometry.spherical.computeDistanceBetween(vehicle.positions[0], new_latlng);
        } else {
            // subtracked the distance between the two points where we gonna insert the new one
            vehicle.path_length -= google.maps.geometry.spherical.computeDistanceBetween(vehicle.positions[idx-1], vehicle.positions[idx]);

            // calculate the distance with the new point in place
            vehicle.path_length += google.maps.geometry.spherical.computeDistanceBetween(vehicle.positions[idx-1], new_latlng);
            vehicle.path_length += google.maps.geometry.spherical.computeDistanceBetween(vehicle.positions[idx], new_latlng);
        }

        // insert the new position into our arrays
        vehicle.positions.splice(idx, 0, new_latlng);
        vehicle.positions_ts.splice(idx, 0, new_ts);
        vehicle.positions_ids.splice(idx, 0, position.position_id);
        vehicle.num_positions++;

        graphAddPosition(vcallsign, position);
    }

    vehicle.updated = true;

    // record the start of flight
    if(new_ts < vehicle.start_time) {
        vehicle.start_time = new_ts;
    }

    // record the highest altitude
    if(parseFloat(position.gps_alt) > vehicle.max_alt) {
        vehicle.max_alt = parseFloat(position.gps_alt);
    }

    return;
}

function updateGraph(vcallsign, reset_selection) {
    if(!plot || !plot_open) return;

    if(reset_selection) {
        if(vcallsign !== null) delete plot_options.xaxis;

        if(polyMarker) polyMarker.setPosition(null);
        plot_crosshair_locked = false;

        // reset nite overlay
        nite.setDate(null);
        nite.refresh();

        $("#timebox").removeClass('past').addClass('present');
        updateTimebox(new Date());
    }

    if(vcallsign === null || !vehicles.hasOwnProperty(vcallsign)) return;

    var series = vehicles[vcallsign].graph_data;

    // if we are drawing the plot for the fisrt time
    // and the dataset is too large, we set an initial selection of the last 7 days
    if(!plot_options.hasOwnProperty('xaxis')) {
        if(series.length && series[0].data.length > 4001) {
            var last = series[0].data.length - 1;
            var end_a = series[0].data[last][0];
            var end_b = (series[1].data.length) ? series[1].data[series[1].data.length - 1][0] : 0;

            plot_options.xaxis = {
                superzoom: 1,
                min: series[0].data[last-4000][0],
                max: Math.max(end_a, end_b),
            };

        }
    }

    // replot graph, with this vehicle data, and this vehicles yaxes config
    plot = $.plot(plot_holder, series, $.extend(plot_options, {yaxes:vehicles[vcallsign].graph_yaxes}));
    graph_vehicle = follow_vehicle;

    vehicles[vcallsign].graph_data_updated = false;
}

var graph_gap_size_default = 180000; // 3 mins in milis
var graph_gap_size_max = 31536000000;
var graph_gap_size = offline.get('opt_interpolate') ? graph_gap_size_max : graph_gap_size_default;
var graph_pad_size = 120000; // 2 min

function graphAddPosition(vcallsign, new_data) {

    var vehicle = vehicles[vcallsign];
    vehicle.graph_data_updated = true;

    var data = vehicle.graph_data;
    var ts = convert_time(new_data.gps_time);
    var splice = false;
    var splice_idx = 0;
    var splice_remove = 0;
    var splice_pad = false;
    var i;

    if(data.length) {
        var ts_last_idx = data[0].data.length - 1;
        var ts_last = data[0].data[ts_last_idx][0];

        if(data[0].data.length) {
            if(data[0].data[ts_last_idx][0] > ts) splice = true;
        }

        if(splice) {
            // Good luck figuring out the following code. -Rossen

            // find an insertion point for the new datum
            var xref = data[0].data;
            i = xref.length - 1;
            var max = i;
            for(; i >= 0; i--) {
                if(ts > xref[i][0]) break;
            }
            splice_idx = i+1;


            if(i > -1) {
                // this is if new datum hits padded area
                if((xref[i][1] === null && xref[i][0] - 1 + (graph_gap_size - graph_pad_size) >= ts)) {
                    splice_remove = 2;
                    splice_idx = i-1;
                }
                else if(i+1 <= max && xref[i+1][1] === null) {
                    splice_remove = 2;
                    splice_idx = i;
                }
                else if(i+2 <= max && xref[i+2][1] === null) {
                    splice_remove = 2;
                    splice_idx = i+1;

                }
                // should we pad before the new datum
                else if (xref[i][1] !== null && xref[i][0] + graph_gap_size < ts) {
                    // pad with previous datum
                    $.each(data, function(k,v) {
                        if(k==1) return; // skip prediction series

                        v.data.splice(i+1, 0, [xref[i][0]+graph_pad_size, v.data[i][1]], [xref[i][0]+graph_pad_size+1, null]);
                        v.nulls += 2;
                    });

                    splice_idx += 2;
                }

            }

            // should we pad after
            if(ts + graph_gap_size < xref[splice_idx+splice_remove][0]) {
                splice_pad = true;
            }

        }
        else {
            //insert gap when there are 3mins, or more, without telemetry
            if(ts_last + graph_gap_size < ts) {
                $.each(data, function(k,v) {
                    if(k==1) return; // skip prediction series

                    v.data.push([ts_last+graph_pad_size, v.data[ts_last_idx][1]]);
                    v.data.push([ts_last+graph_pad_size+1, null]);
                    v.nulls += 2;
                });
            }
        }
        // update the selection upper limit to the latest timestamp, only if the upper limit is equal to the last timestamp
        if(plot_options.xaxis && follow_vehicle == vcallsign && ts_last == plot_options.xaxis.max && ts > ts_last) plot_options.xaxis.max = ts;
    }

    i = 0;
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

        vehicle.graph_yaxes[i].max = 0;
        i += 1;

        data[i] = {
                    label: "pred.alt. = 0",
                    color: '#999999',
                    yaxis: i+1,
                    lines: { show:true, fill: false, },
                    nulls: 0,
                    data: []
                  };

        vehicle.graph_yaxes[i].max = 0;
    }

    // set yrange for altitude and pred.alt, so they are aligned
    if(parseInt(new_data.gps_alt) < vehicle.graph_yaxes[0].min) {
        vehicle.graph_yaxes[0].min = parseInt(new_data.gps_alt);
        vehicle.graph_yaxes[1].min = vehicle.graph_yaxes[0].min;
    }

    if(parseInt(new_data.gps_alt) > vehicle.graph_yaxes[0].max) {
        vehicle.graph_yaxes[0].max = parseInt(new_data.gps_alt);
        vehicle.graph_yaxes[1].max = vehicle.graph_yaxes[0].max;
    }

    // we don't record extra data, if there is no telemetry graph loaded
    // altitude is used for altitude profile
    if(plot && new_data.data !== "") {

        // the rest of the series is from the data field
        var json = (typeof new_data.data === "string") ? $.parseJSON(new_data.data) : new_data.data;

        // init empty data matrix
        var data_matrix = [];
        var k;
        for(k in vehicle.graph_data_map) data_matrix[vehicle.graph_data_map[k]] = [ts, null];

        $.each(json, function(k, v) {
            if(isNaN(v) || v==="") return;        // only take data that is numerical

            i = (k in vehicle.graph_data_map) ? vehicle.graph_data_map[k] : data.length;

            if(i >= 8) return;  // up to 7 seperate data plots only, 1 taken by alt, 1 by prediction

            if(data[i] === undefined) {
                // configure series
                data[i] = {
                            label: k + " = 0",
                            key: k,
                            yaxis: i + 1,
                            nulls: 0,
                            data: []
                          };

                // when a new data field comes in packet other than the first one
                if(data[0].data.length > 0) {
                    var xref = data[0].data;

                    data[i].data = new Array(xref.length);

                    // we intialize it's series entry with empty data
                    // all series need to be the same length for slicing to work
                    for(var kk in xref) {
                        data[i].data[kk] = [xref[kk][0], null];
                    }

                }

                vehicle.graph_data_map[k] = i;
                data_matrix[i] = [ts, null];

                // additinal series configuration
                if(isInt(v)) $.extend(true, data[i], { noInterpolate: true, lines: { steps: true }});
            }

            if(parseFloat(v) < 0) delete vehicle.graph_yaxes[i].min;

            data_matrix[i][1] = parseFloat(v);
        });

        for(k in data_matrix) {
            if(splice) {
                if(splice_pad) {
                    data[k].data.splice(splice_idx, splice_remove, data_matrix[k], [ts+graph_pad_size, data_matrix[k][1]], [ts+graph_pad_size+1, null]);
                    data[k].nulls += 2;
                } else {
                    data[k].data.splice(splice_idx, splice_remove, data_matrix[k]);
                }
                data[k].nulls -= splice_remove;
            } else {
                data[k].data.push(data_matrix[k]);
            }
        }
    }

    // push latest altitude
    if(splice) {
        if(splice_pad) {
            data[0].data.splice(splice_idx, splice_remove, [ts, parseInt(new_data.gps_alt)], [ts+graph_pad_size, parseInt(new_data.gps_alt)], [ts+graph_pad_size+1, null]);
            data[0].nulls += 2;
        } else {
            data[0].data.splice(splice_idx, splice_remove, [ts, parseInt(new_data.gps_alt)]);
        }
        data[0].nulls -= splice_remove;
    } else {
        data[0].data.push([ts, parseInt(new_data.gps_alt)]);
    }
}

var ajax_positions = null;
var ajax_inprogress = false;

function refresh() {
  if(ajax_inprogress) {
    clearTimeout(periodical);
    periodical = setTimeout(refresh, 2000);
    return;
  }

  ajax_inprogress = true;

  $("#stText").text("checking |");

  if(/[a-z0-9]{32}/ig.exec(wvar.query)) {
      tmpC.setVisible(false);
      initHabitat();
      return;
  } else {
      tmpC.setVisible(true);
  }

  var mode = wvar.mode.toLowerCase();
  mode = (mode == "position") ? "latest" : mode.replace(/ /g,"");

  var data_str = "mode="+mode+"&type=positions&format=json&max_positions=" + max_positions + "&position_id=" + position_id + "&vehicles=" + encodeURIComponent(wvar.query);

  ajax_positions = $.ajax({
    type: "GET",
    url: data_url,
    data: data_str,
    dataType: "json",
    success: function(response, textStatus) {
        $("#stText").text("loading |");
        response.fetch_timestamp = Date.now();
        update(response);
        $("#stText").text("");
        $("#stTimer").attr("data-timestamp", response.fetch_timestamp);
    },
    error: function() {
        $("#stText").text("error |");

        if(!zoomed_in && offline.get('opt_offline')) {
            var data = offline.get('positions');
            update(data);
            $("#stText").text("no connection |");
            $("#stTimer").attr("data-timestamp", data.fetch_timestamp);
        }
    },
    complete: function(request, textStatus) {
        clearTimeout(periodical);
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

var ajax_predictions = null;

function refreshPredictions() {
    //if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'ajax', 'refresh', 'Predictions']);
    if(ajax_inprogress) {
      clearTimeout(periodical_predictions);
      periodical_predictions = setTimeout(refreshPredictions, 1000);
      return;
    }

    ajax_predictions = $.ajax({
        type: "GET",
        url: predictions_url + encodeURIComponent(wvar.query),
        data: "",
        dataType: "json",
        success: function(response, textStatus) {
            offline.set('predictions', "");
            updatePredictions(response);
        },
        error: function() {
        },
        complete: function(request, textStatus) {
            clearTimeout(periodical_predictions);
            periodical_predictions = setTimeout(refreshPredictions, 60 * 1000);
        }
    });
}

function habitat_translation_layer(json_result, prefix) {
    if(json_result.rows.length === 0) {
        habitat_payload_step(true);
        return;
    }

    json_result = json_result.rows;

    var result = {positions: { position: [] }};
    result.fetch_timestamp = Date.now();
    $("#stTimer").attr("data-timestamp", result.fetch_timestamp);

    for(var i in json_result) {
        var doc = json_result[i].doc;

        if(doc.data.latitude === 0 && doc.data.longitude === 0) continue;

        var row = habitat_doc_to_snus(doc, prefix);

        result.positions.position.push(row);
    }

    if(result.positions.position.length) update(result);

    // next step
    periodical = setTimeout(function() {
        habitat_payload_step();
    }, 500);
}

var habitat_field_blacklist = {
    altitude: 1,
    date: 1,
    latitude: 1,
    longitude: 1,
    payload: 1,
    sentence_id: 1,
    time: 1,
};

function habitat_doc_to_snus(doc, prefix) {
    prefix = prefix || '';

    var row = {
        'position_id': doc._id,
        'vehicle': prefix + doc.data.payload,
        'server_time': doc.data._parsed.time_parsed,
        'sequence': doc.data.sentence_id,
        'gps_lat': doc.data.latitude,
        'gps_lon': doc.data.longitude,
        'gps_alt': doc.data.altitude,
        'callsign': "HABITAT ARCHIVE",
        'data': {}
    };

    try {
        row.gps_time = "20" + doc.data.date.replace(/([0-9]{2})/g, "$1-") + doc.data.time;
    } catch (e) {
        row.gps_time = row.server_time;
    }

    // move all other properties as data
    for(var x in doc.data) {
        // skip internal and reserved vars
        if(x[0] == '_' || habitat_field_blacklist.hasOwnProperty(x)) continue;

        row.data[x] = doc.data[x];
    }
    row.data = JSON.stringify(row.data);

    return row;
}

var habitat_payload_step_data;

function habitat_payload_step(remove_current) {
    remove_current = !!remove_current;

    if(remove_current) {
        habitat_payload_step_data.payloads.splice(habitat_payload_step_data.idx, 1);
    }

    if(habitat_payload_step_data.payloads.length === 0) {
        $("#stText").text("");
        $("#main .header.empty").html("<span>No vehicles :(</span>");
        return;
    }

    habitat_payload_step_data.idx += 1;
    habitat_payload_step_data.idx = habitat_payload_step_data.idx % habitat_payload_step_data.payloads.length;

    var prefix = habitat_payload_step_data.payloads[habitat_payload_step_data.idx].prefix;
    var url = habitat_payload_step_data.payloads[habitat_payload_step_data.idx].url;
    url += habitat_payload_step_data.payloads[habitat_payload_step_data.idx].skip;
    habitat_payload_step_data.payloads[habitat_payload_step_data.idx].skip += habitat_max;

    ajax_positions = $.getJSON(url, function(response) {
            habitat_translation_layer(response, prefix);
    });
}

function initHabitat() {
    $("#stText").text("loading |");

    habitat_payload_step_data = {
        idx: 0,
        payloads: [],
    };
    var habitat_docs = [];

    wvar.query.split(";").forEach(function(v) {
        v = v.trim();
        if(/^[a-z0-9]{32}$/ig.exec(v)) habitat_docs.push(v);
    })

    habitat_doc_step(habitat_docs);
}


function habitat_doc_step(hab_docs) {
    var docid = hab_docs.shift();

    ajax_positions = $.ajax({
        type: "GET",
        url: habitat_url + docid,
        data: "",
        dataType: "json",
        success: function(response, textStatus) {
            if(response.type == "flight") {
                if(response.payloads.length > 0) {
                    ts_start = convert_time(response.start) / 1000;
                    ts_end = convert_time(response.end) / 1000;


                    response.payloads.forEach( function(payload_id) {
                        var url = habitat_url_payload_telemetry.replace(/\{ID\}/g, payload_id);
                        url = url.replace("{START}", ts_start).replace("{END}", ts_end);

                        habitat_payload_step_data.payloads.push({
                            prefix: response._id.substr(-4) + "/",
                            url: url,
                            skip: 0,
                        });
                    });
                }
            }
            else {
                if(hab_docs.length === 0) update(null);
                console.error("tracker: docid", docid, " is not a flight_doc");
            }

            if(hab_docs.length === 0) {
                habitat_payload_step();
            } else {
                habitat_doc_step(hab_docs);
            }
        },
        error: function() {
            if(hab_docs.length === 0) update(null);
            console.error("tracker: error trying to load docid", docid);
        },
        complete: function(request, textStatus) {
        }
    });
}


var periodical, periodical_receivers;
var periodical_predictions = null;
var timer_seconds = 15;

function startAjax() {
    // prevent insane clicks to start numerous requests
    clearTimeout(periodical);
    clearTimeout(periodical_receivers);
    clearTimeout(periodical_predictions);

    //periodical = setInterval(refresh, timer_seconds * 1000);
    refresh();

    //periodical_listeners = setInterval(refreshReceivers, 60 * 1000);
    refreshReceivers();
}

function stopAjax() {
    // stop our timed ajax
    clearTimeout(periodical);
    if(ajax_positions) ajax_positions.abort();

    clearTimeout(periodical_predictions);
    periodical_predictions = null;
    if(ajax_predictions) ajax_predictions.abort();
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

        // Filter out any receivers that are from the TTN Bridge code, and that are older than 1 hour.
        // This helps de-clutter the map during launches utilising TTN, and that result in *many* new 
        // receivers showing up on the map.
        var age = parseFloat(r[i].tdiff_hours); // Grab age of the receiver.
        if(r[i].description.includes('TTN_LORAWAN_GW') && age > 1.0) continue;

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
    i = 0;
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

    if(follow_vehicle !== null) drawLOSPaths(follow_vehicle);
}

function updatePredictions(r) {
    if(!r) return;
    ls_pred = true;

    var i = 0, ii = r.length;
    for(; i < ii; i++) {
        var vcallsign = r[i].vehicle;

        if(vcallsign == "XX") continue;

		if(vehicles.hasOwnProperty(vcallsign)) {
            var vehicle = vehicles[vcallsign];

            if(vcallsign in hysplit || vehicle.marker.mode == "landed") {
                removePrediction(vcallsign);
                continue;
            }

			if(vehicle.prediction && vehicle.prediction.time == r[i].time) {
				continue;
			}
            vehicle.prediction = r[i];
            if(parseInt(vehicle.prediction.landed) === 0) {
                vehicle.prediction.data = $.parseJSON(r[i].data);
                redrawPrediction(vcallsign);
            } else {
                removePrediction(vcallsign);
            }
	    }
	}
}

function refreshUI() {
    for(var vcallsign in vehicles) {
        updateVehicleInfo(vcallsign, vehicles[vcallsign].curr_position);
    }

    mapInfoBox.close();
    if(follow_vehicle !== null) update_lookangles(follow_vehicle);
}


function hideHorizonRings(){
    for(var vcallsign in vehicles) {
        if(vehicles[vcallsign].vehicle_type == "balloon"){
            vehicles[vcallsign].horizon_circle.setVisible(false);
            vehicles[vcallsign].horizon_circle.label.set('visible', false);
            vehicles[vcallsign].subhorizon_circle.setVisible(false);
            vehicles[vcallsign].subhorizon_circle.label.set('visible', false);
        }
    }
}
function showHorizonRings(){
    for(var vcallsign in vehicles) {
        if(vehicles[vcallsign].vehicle_type == "balloon"){
            vehicles[vcallsign].horizon_circle.setVisible(true);
            vehicles[vcallsign].horizon_circle.label.set('visible', true);
            vehicles[vcallsign].subhorizon_circle.setVisible(true);
            vehicles[vcallsign].subhorizon_circle.label.set('visible', true);
        }
    }
}

var ssdv = {};
var status = "";
var bs_idx = 0;

function update(response) {
    if (response === null ||
        !response.positions ||
        !response.positions.position ||
        !response.positions.position.length) {

        // if no vehicles are found, this will remove the spinner and put a friendly message
        $("#main .empty").html("<span>No vehicles :(</span>");

        ajax_inprogress = false;

        return;
    }

    ssdv = (!response.ssdv) ? {} : response.ssdv;

    // create a dummy response object for postions
    var lastPositions = { positions: { position: [] } };
    var ctx_init = {
        positions: response.positions.position,
        lastPositions: lastPositions,
        lastPPointer: lastPositions.positions.position,
        idx: 0,
        max: response.positions.position.length,
        step: function(ctx) {
            var draw_idx = -1;

            var i = ctx.idx;
            var max = i + 5000;
            max = (max >= ctx.max) ? ctx.max : max;

            for (; i < max ; i++) {
                var row = ctx.positions[i];

                if(row.position_id > position_id) { position_id = row.position_id; }

                if (!row.picture) {
                    addPosition(row);
                    got_positions = true;
                }
            }

            ctx.idx = max;

            if(ctx.idx < ctx.max) {
              setTimeout(function() { ctx.step(ctx); }, 4);
            } else {
              ctx.list = Object.keys(vehicles);
              setTimeout(function() { ctx.draw(ctx); }, 16);
            }
        },
        draw: function(ctx) {
            if(ctx.list.length < 1) {
              setTimeout(function() { ctx.end(ctx); }, 16);
              return;
            }

            // pop a callsign from the top
            var vcallsign = ctx.list.shift();
            var vehicle = vehicles[vcallsign];

            if(vehicle === undefined) return;

            if(vehicle.updated) {
                updatePolyline(vcallsign);
                updateVehicleInfo(vcallsign, vehicle.curr_position);

                // remember last position for each vehicle
                ctx.lastPPointer.push(vehicle.curr_position);

                if(listScroll) listScroll.refresh();
                if(zoomed_in && follow_vehicle == vcallsign && !manual_pan) panTo(follow_vehicle);
                if(follow_vehicle == vcallsign) drawLOSPaths(vcallsign);
            }

            // step to the next callsign
            setTimeout(function() { ctx.draw(ctx); }, 16);
        },
        end: function(ctx) {

          // update graph is current vehicles is followed
          if(follow_vehicle !== null &&
             vehicles.hasOwnProperty(follow_vehicle) &&
             vehicles[follow_vehicle].graph_data_updated) updateGraph(follow_vehicle, false);

          // store in localStorage
          offline.set('positions', ctx.lastPositions);

          if (got_positions && !zoomed_in && Object.keys(vehicles).length) {
              zoom_on_payload();
          }

          if(periodical_predictions === null) refreshPredictions();

          ajax_inprogress = false;
        }
    };

    ctx_init.step(ctx_init);
}

function zoom_on_payload() {

    // find a the first balloon
    var target = null, vcallsign = null, fallback = false;

    if(wvar.focus !== "" && vehicles.hasOwnProperty(wvar.focus)) {
        target = vehicles[wvar.focus];
        vcallsign = wvar.focus;
    } else if(wvar.focus === "" && wvar.zoom) {
        fallback = true;
        for(var k in vehicles) {
            if(vehicles[k].vehicle_type == "balloon") {
                vcallsign = k;
                target = vehicles[k];
                break;
            }
        }
    } else {
        zoomed_in = true;
        return;
    }

    if(fallback) {
        if(target) {
            // find the bounds of the ballons first and last positions
            var bounds = new google.maps.LatLngBounds();
            bounds.extend(target.positions[0]);
            bounds.extend(target.positions[target.positions.length - 1]);

            // fit the map to those bounds
            map.fitBounds(bounds);

            // limit the zoom level to 11
            if(map.getZoom() > 11) map.setZoom(11);
        }

        // this condition is true, when we there is no focus vehicle specified, or balloon in list
        // we then fallback to zooming in onto the first vehicle, if there is one
        if(target === null) {
            var list = Object.keys(vehicles);

            // if there are no vehicles, return, else zoom in on the first one
            if(list.length === 0) return;
            else {
                vcallsign = list[0];
                target = vehicles[vcallsign];
            }
        }
    }

    // pan and follow the vehicle
    followVehicle(vcallsign, !wvar.zoom, true);

    // expand list element
    $('.vehicle'+target.uuid).addClass('active');

    // scroll list to the expanded element
    listScroll.refresh();
    listScroll.scrollToElement('.portrait .vehicle'+target.uuid);

    zoomed_in = true;
}

function isInt(n) {
   return n % 1 === 0;
}
