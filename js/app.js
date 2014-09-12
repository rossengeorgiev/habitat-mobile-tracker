// detect if mobile
var is_mobile = false;

if(
 navigator.userAgent.match(/Android/i)
 || navigator.userAgent.match(/iPhone/i)
 || navigator.userAgent.match(/iPod/i)
 || navigator.userAgent.match(/iPad/i)
 || navigator.userAgent.match(/Windows Phone/i)
 || navigator.userAgent.match(/webOS/i)
 || navigator.userAgent.match(/BlackBerry/i)
 ) is_mobile = true;

// wvar detection
var vfilter = "";
var nyan_mode = false;

var wvar = {
    enabled: false,
    vlist: true,
    graph: true,
    graph_exapnded: false,
    latestonly: is_mobile,
    focus: "",
    docid: ""
}
var params = window.location.search.substring(1).split('&');

for(var idx in params) {
    var line = params[idx].split('=');
    if(line.length < 2) continue;

    switch(line[0]) {
        case "wvar": if(line[1] == "1") wvar.enabled = true; break;
        case "hidelist": if(line[1] == "1") wvar.vlist = false; break;
        case "hidegraph": if(line[1] == "1") wvar.graph = false; break;
        case "expandgraph": if(line[1] == "1") wvar.graph_expanded = true; break;
        case "filter": vfilter = line[1]; break;
        case "nyan": nyan_mode = true; break;
        case "latestonly": wvar.latestonly = (parseInt(line[1]) == 1) ? true : false; break;
        case "focus": wvar.focus = line[1]; break;
        case "docid": wvar.docid = line[1]; break;
    }
}

if(wvar.latestonly) $("#latestonly").show();

if(wvar.enabled) {
    //analytics
    if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'Functionality', 'Embed Opts', window.location.search]);
}

$.ajaxSetup({ cache: true });

var force_check_cache = false;

// handle cachin events and display a loading bar
var loadComplete = function(e) {
    clearTimeout(initTimer);

    if(e.type == 'updateready') {
        // swapCache may throw exception if the isn't a previous cache
        try {
            window.applicationCache.swapCache();
        } catch(e) {}

        window.location.reload();
        return;
    }

    $('#loading .complete').stop(true,true).animate({width: 200}, {complete: trackerInit });
}

var hysplit = {};
var hysplit_data = {};
var refresh_hysplit = function() {
    $.getJSON("http://spacenear.us/tracker/datanew.php?type=hysplit&format=json", function(data) {
        var refresh = false;

        for(var k in data) {
            if(k in hysplit_data) {
                // if the jobid is the same, skip to next one
                if(hysplit_data[k].jobid == data[k].jobid) continue;

                // otherwise update the url
                hysplit_data[k] = data[k];
                hysplit[k].setUrl(hysplit_data[k].url_kmz);
            } else {
                hysplit_data[k] = data[k];
                hysplit[k] = new google.maps.KmlLayer({url: hysplit_data[k].url_kmz, preserveViewport:true });
                refresh = true;
            }
        }

        if(refresh) refreshUI();
    });
}

// loads the tracker interface
function trackerInit() {
    $('#loading,#settingsbox,#aboutbox,#chasebox').hide(); // welcome screen
    $('header,#main').show(); // interface elements

    if(map) return;

    if(is_mobile || wvar.enabled) $(".nav .wvar").hide();

    if(!is_mobile) {
        $.getScript("js/init_plot.js", function() { checkSize(); if(!map) load(); });
        if(wvar.graph) $('#telemetry_graph').attr('style','');

        // fetch hysplit jobs
        setInterval(refresh_hysplit, 60 * 1000);
        refresh_hysplit();

        return;
    }
    checkSize();
    if(!map) load();
}

// if for some reason, applicationCache is not working, load the app after a 3s timeout
var initTimer = setTimeout(trackerInit, 3000);

var cache = window.applicationCache;
cache.addEventListener('noupdate', loadComplete, false);
cache.addEventListener('updateready', loadComplete, false);
cache.addEventListener('cached', loadComplete, false);
cache.addEventListener('error', loadComplete, false);

// if the browser supports progress events, display a loading bar
cache.addEventListener('checking', function() { if(map && !force_check_cache) return; force_check_cache = false; clearTimeout(initTimer); $('#loading .bar,#loading').show(); $('#loading .complete').css({width: 0}); }, false);
cache.addEventListener('progress', function(e) { $('#loading .complete').stop(true,true).animate({width: (200/e.total)*e.loaded}); }, false);

var listScroll;
var GPS_ts = null;
var GPS_lat = null;
var GPS_lon = null;
var GPS_alt = null;
var GPS_speed = null;
var CHASE_enabled = null;
var CHASE_listenerSent = false;
var CHASE_timer = 0
var callsign = "";

function checkSize() {
    // we are in landscape mode
    w = $(window).width();
    w = (w < 320) ? 320 :  w; // absolute minimum 320px
    h = $(window).height();
    //h = (h < 300) ? 300 :  h; // absolute minimum 320px minus 20px for the iphone bar
    hh = $('header').height();

    $("#mapscreen,.flatpage").height(h-hh-5);

    sw = (wvar.vlist) ? 199 : 0;

    $('.container').width(w-20);

    if($('.landscape:visible').length) {
        $('#main').height(h-hh-5);
        if($('#telemetry_graph .graph_label').hasClass('active')) {
            $('#map').height(h-hh-5-200);
        } else {
            $('#map').height(h-hh-5);
        }
        $('body,#loading').height(h);
        $('#mapscreen,#map,#telemetry_graph,#telemetry_graph .holder').width(w-sw);
        $('#main').width(sw);
    } else { // portrait mode
        //if(h < 420) h = 420;
        var mh = (wvar.vlist) ? 180 : 0;

        $('body,#loading').height(h);
        $('#map,#mapscreen').height(h-hh-5-mh);
        $('#map,#mapscreen').width(w);
        $('#main').height(mh); // 180px is just enough to hold one expanded vehicle
        $('#main').width(w);
    }

    // this should hide the address bar on mobile phones, when possible
    window.scrollTo(0,1);

    if(map) google.maps.event.trigger(map, 'resize');
}

window.onresize = checkSize;
window.onchangeorientation = checkSize;


// functions

function positionUpdateError(error) {
    switch(error.code)
    {
        case error.PERMISSION_DENIED:
            alert("no permission to use your location");
            $('#sw_chasecar').click(); // turn off chase car
            break;
        default:
        break;
    }
}

var positionUpdateHandle = function(position) {
    if(CHASE_enabled && !CHASE_listenerSent) {
        if(offline.get('opt_station')) {
            ChaseCar.putListenerInfo(callsign);
            CHASE_listenerSent = true;
        }
    }

    //navigator.geolocation.getCurrentPosition(function(position) {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        var alt = (position.coords.altitude) ? position.coords.altitude : 0;
        var accuracy = (position.coords.accuracy) ? position.coords.accuracy : 0;
        var speed = (position.coords.speed) ? position.coords.speed : 0;

        // constantly update 'last updated' field, and display friendly time since last update
        if(!GPS_ts) {
            GPS_ts = parseInt(position.timestamp/1000);

            setInterval(function() {
                var delta_ts = parseInt(Date.now()/1000) - GPS_ts;

                // generate friendly timestamp
                var hours = Math.floor(delta_ts / 3600);
                var minutes = Math.floor(delta_ts / 60) % 60;
                var ts_str = (delta_ts >= 60) ?
                                    ((hours)?hours+'h ':'')
                                    + ((minutes)?minutes+'m':'')
                                    + ' ago'
                                : 'just now';
                $('#cc_timestamp').text(ts_str);
            }, 30000);

            $('#cc_timestamp').text('just now');
        }

        // save position and update only if different is available
        if(CHASE_timer < (new Date()).getTime()
           && (
           GPS_lat != lat
           || GPS_lon != lon
           || GPS_alt != alt
           || GPS_speed != speed)
        )
        {
            GPS_lat = lat;
            GPS_lon = lon;
            GPS_alt = alt;
            GPS_speed = speed;
            GPS_ts = parseInt(position.timestamp/1000);
            $('#cc_timestamp').text('just now');

            // update look angles once we get position
            if(follow_vehicle > -1) { update_lookangles(follow_vehicle); }

            if(CHASE_enabled) {
                ChaseCar.updatePosition(callsign, position);
                CHASE_timer = (new Date()).getTime() + 15000;

                if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'upload', 'chase car position']);
            }
        }
        else { return; }

        // add/update marker on the map (tracker.js)
        updateCurrentPosition(lat, lon);

        // round the coordinates
        lat = parseInt(lat * 10000)/10000;  // 4 decimal places (11m accuracy at equator)
        lon = parseInt(lon * 10000)/10000;  // 4 decimal places
        speed = parseInt(speed * 10)/10;        // 1 decimal place
        accuracy = parseInt(accuracy);
        alt = parseInt(alt);

        // dispaly them in the top right corner
        $('#app_name b').html(lat + '<br/>' + lon);

        // update chase car interface
        $('#cc_lat').text(lat);
        $('#cc_lon').text(lon);
        $('#cc_alt').text(alt + " m");
        $('#cc_accuracy').text(accuracy + " m");
        $('#cc_speed').text(speed + " m/s");
    /*
    },
    function() {
        // when there is no location
        $('#app_name b').html('mobile<br/>tracker');
    });
    */
}

var twoZeroPad = function(n) {
    n = String(n);
    return (n.length<2) ? '0'+n : n;
}

// updates timebox
var updateTimebox = function(date) {
    var elm = $("#timebox");
    var a,b,c,d,e,f,g,z;

    a = date.getUTCFullYear();
    b = twoZeroPad(date.getUTCMonth()+1); // months 0-11
    c = twoZeroPad(date.getUTCDate());
    e = twoZeroPad(date.getUTCHours());
    f = twoZeroPad(date.getUTCMinutes());
    g = twoZeroPad(date.getUTCSeconds());

    elm.find(".current").text("Current: "+a+'-'+b+'-'+c+' '+e+':'+f+':'+g+" UTC");

    a = date.getFullYear();
    b = twoZeroPad(date.getMonth()+1); // months 0-11
    c = twoZeroPad(date.getDate());
    e = twoZeroPad(date.getHours());
    f = twoZeroPad(date.getMinutes());
    g = twoZeroPad(date.getSeconds());
    z = date.getTimezoneOffset() / -60;

    elm.find(".local").text("Local: "+a+'-'+b+'-'+c+' '+e+':'+f+':'+g+" UTC"+((z<0)?"-":"+")+z);
}

var format_time_friendly = function(start, end) {
    var dt = Math.floor((end - start) / 1000);
    if(dt < 0) return null;

    if(dt < 60) return dt + 's';
    else if(dt < 3600) return Math.floor(dt/60)+'m';
    else if(dt < 86400) {
        dt = Math.floor(dt/60);
        return Math.floor(dt/60)+'h '+(dt % 60)+'m';
    } else {
        dt = Math.floor(dt/3600);
        return Math.floor(dt/24)+'d '+(dt % 24)+'h';
    }
}

// runs every second
var updateTime = function(date) {
    // update timebox
    var elm = $("#timebox.present");
    if(elm.length > 0) updateTimebox(date);

    // update friendly delta time fields
    var elm = $(".friendly-dtime");
    if(elm.length > 0) {
        var now = new Date().getTime();

        elm.each(function(k,v) {
            var e = $(v);
            var ts = e.attr('data-timestamp');
            var str = format_time_friendly(ts, now);
            if(str) e.text(str + ' ago');
        });
    }
}


$(window).ready(function() {
    // refresh timebox
    setInterval(function() {
        updateTime(new Date());
    }, 1000);

    // resize elements if needed
    checkSize();

    // add inline scroll to vehicle list
    listScroll = new iScroll('main', { hScrollbar: false, hScroll: false, snap: false, scrollbarClass: 'scrollStyle' });

    $('#telemetry_graph').on('click', '.graph_label', function() {
        var e = $(this);
        if(e.hasClass('active')) {
            e.removeClass('active');
            var h = $('#map').height() + $('#telemetry_graph').height();

            plot_open = false;

            //analytics
            if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'UI', 'Collapse', 'Telemetry Graph']);
        } else {
            e.addClass('active');
            var h = $('#map').height() - $('#telemetry_graph').height();

            plot_open = true;

            //analytics
            if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'UI', 'Expand', 'Telemetry Graph']);
        }
        $('#map').stop(null,null).animate({'height': h}, function() {
            if(map) google.maps.event.trigger(map, 'resize');

            if(plot_open && follow_vehicle != -1 && vehicles[follow_vehicle].graph_data_updated) updateGraph(follow_vehicle, true);
        });
    });

    // expand graph on startup, if nessary
    if(wvar.graph_expanded) $('#telemetry_graph .graph_label').click();

    // hysplit button
    $("#main").on('click','.row .data .hysplit', function(event) {
        event.stopPropagation();

        var elm = $(this);
        var name = vehicle_names[elm.attr('data-index')]

        if(elm.hasClass("active")) {
            elm.removeClass('active');
            hysplit[name].setMap(null);
        }
        else {
            elm.addClass('active');
            hysplit[name].setMap(map);
        }
    });

    // reset nite-overlay and timebox when mouse goes out of the graph box
    $("#telemetry_graph").on('mouseout','.holder', function() {
        nite.setDate(null);
        nite.refresh();

        $("#timebox").removeClass('past').addClass('present');
        updateTimebox(new Date());
    });

    // hand cursor for dragging the vehicle list
    $("#main").on("mousedown", ".row", function () {
        $("#main").addClass("drag");
    })
    $("body").on("mouseup", function () {
        $("#main").removeClass("drag");
    });

    // confirm dialog when launchnig a native map app with coordinates
    $('#main').on('click', '#launch_mapapp', function() {
        var answer = confirm("Launch your maps app?");

        //analytics
        if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'Functionality', ((answer)?"Yes":"No"), 'Coord Click']);

        return answer;
    });

    // follow vehicle by clicking on data
    $('#main').on('click', '.row .data', function() {
        var e = $(this).parent();
        followVehicle(parseInt(e.attr('class').match(/vehicle(\d+)/)[1]));
    });

    // expand/collapse data when header is clicked
    $('#main').on('click', '.row .header', function() {
        var e = $(this).parent();
        if(e.hasClass('active')) {
            // collapse data for selected vehicle
            e.removeClass('active');
            e.find('.data').hide();

            listScroll.refresh();

            // disable following only we are collapsing the followed vehicle
            if(follow_vehicle == parseInt(e.attr('class').match(/vehicle(\d+)/)[1])) {
                stopFollow();
            }
        } else {
            // expand data for selected vehicle
            e.addClass('active');
            e.find('.data').show();

            listScroll.refresh();

            // auto scroll when expanding an item
            if($('.portrait:visible').length) {
                var eName = "." + e.parent().attr('class') + " ." + e.attr('class').match(/vehicle\d+/)[0];
                listScroll.scrollToElement(eName);
            }

            // pan to selected vehicle
            followVehicle(parseInt(e.attr('class').match(/vehicle(\d+)/)[1]));
        }
    });

    // menu interface options
    $('.nav')
    .on('click', 'li', function() {
        var e = $(this);
        var name = e.attr('class').replace(" last","");
        var box = $("#"+name+"box");

        if(box.is(':hidden')) {
            $('.flatpage').hide();
            box.show().scrollTop(0);

            // analytics
            var pretty_name;
            switch(name) {
                case "home": pretty_name = "Map"; break;
                case "chasecar": pretty_name = "Chase Car"; break;
                default: pretty_name = name[0].toUpperCase() + name.slice(1);
            }

            if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'UI Menubar', 'Open Page', pretty_name]);
        }
        checkSize();
    })

    // toggle functionality for switch button
    $("#sw_chasecar").click(function() {
        var e = $(this);
        var field = $('#cc_callsign');

        // turning the switch off
        if(e.hasClass('on')) {
            field.removeAttr('disabled');
            e.removeClass('on').addClass('off');

            if(navigator.geolocation) navigator.geolocation.clearWatch(CHASE_enabled);
            CHASE_enabled = null;
            //CHASE_enabled = false;

            // blue man reappers :)
            if(currentPosition && currentPosition.marker) currentPosition.marker.setVisible(true);

            // analytics
            if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'Functionality', 'Turn Off', 'Chase Car']);
        // turning the switch on
        } else {
            if(callsign.length < 5) { alert('Please enter a valid callsign, at least 5 characters'); return; }
            if(!callsign.match(/^[a-zA-Z0-9\_\-]+$/)) { alert('Invalid characters in callsign (use only a-z,0-9,-,_)'); return; }

            field.attr('disabled','disabled');
            e.removeClass('off').addClass('on');

            // push listener doc to habitat
            // this gets a station on the map, under the car marker
            // im still not sure its nessesary
            if(!CHASE_listenerSent) {
                if(offline.get('opt_station')) {
                    ChaseCar.putListenerInfo(callsign);
                    CHASE_listenerSent = true;
                }
            }
            // if already have a position push it to habitat
            if(GPS_ts) {
                ChaseCar.updatePosition(callsign, { coords: { latitude: GPS_lat, longitude: GPS_lon, altitude: GPS_alt, speed: GPS_speed }});
                if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'upload', 'chase car position']);
            }

            if(navigator.geolocation) CHASE_enabled = navigator.geolocation.watchPosition(positionUpdateHandle, positionUpdateError);
            //CHASE_enabled = true;

            // hide the blue man
            if(currentPosition && currentPosition.marker) currentPosition.marker.setVisible(false);

            // analytics
            if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'Functionality', 'Turn On', 'Chase Car']);
        }
    });

    // remember callsign as a cookie
    $("#cc_callsign").on('change keyup', function() {
        callsign = $(this).val().trim();
        offline.set('callsign', callsign); // put in localStorage
        CHASE_listenerSent = false;
    });

    // load value from localStorage
    callsign = offline.get('callsign');
    $('#cc_callsign').val(callsign);

    // settings page

    // list of all switches
    var opts = [
        "#sw_layers_clouds",
        "#sw_layers_aprs",
        "#sw_offline",
        "#sw_station",
        "#sw_imperial",
        "#sw_haxis_hours",
        "#sw_daylight",
        "#sw_hide_receivers",
        "#sw_hide_timebox",
        "#sw_hilight_vehicle"
    ];

    // applies functionality when switches are toggled
    $(opts.join(',')).click(function() {
        var e = $(this);
        var name = e.attr('id').replace('sw', 'opt');
        var on;

        if(e.hasClass('on')) {
            e.removeClass('on').addClass('off');
            on = 0;

            //analytics
            if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'Functionality', 'Turn Off', name]);
        } else {
            e.removeClass('off').addClass('on');
            on = 1;

            //analytics
            if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'Functionality', 'Turn On', name]);
        }

        // remember choice
        offline.set(name, on);

        // execute functionality
        switch(name) {
            case "opt_hilight_vehicle":
                if(on) focusVehicle(follow_vehicle);
                else focusVehicle(-1);
                break;
            case "opt_imperial":
            case "opt_haxis_hours":
                refreshUI();
                break;
            case "opt_daylight":
                if(on) { nite.show(); }
                else { nite.hide(); }
                break;
            case "opt_hide_receivers":
                if(on) {
                    updateReceivers([]);
                    clearTimeout(periodical_listeners);
                }
                else {
                    refreshReceivers();
                }
                break;
            case "opt_hide_timebox":
                var elm = $("#timebox");
                if(on) {
                    elm.removeClass('past').removeClass('present').hide();
                    $('#lookanglesbox').css({top:'7px'});
                } else {
                    elm.addClass('present').show();
                    $('#lookanglesbox').css({top:'40px'});
                }
                break;
            case "opt_layers_aprs":
                if(on) map.overlayMapTypes.setAt("1", overlayAPRS);
                else map.overlayMapTypes.setAt("1", null);
                break;
            case "opt_layers_clouds":
                if(on) { layers_clouds.setMap(map); }
                else { layers_clouds.setMap(null); }
        }
    });

    // set the switch, based on the remembered choice
    for(var k in opts) {
        var switch_id = opts[k];
        var opt_name = switch_id.replace("#sw_", "opt_");

        if(offline.get(opt_name)) $(switch_id).removeClass('off').addClass('on');
    }

    // force re-cache
    $('#sw_cache').click(function() {
        var e = $(this).removeClass('off').addClass('on');
        if(confirm("The app will automatically reload, if new version is available.")) {
            force_check_cache = true;

            try {
                applicationCache.update();
            } catch (e) {
                force_check_cache = false;
                alert("There is no applicationCache available");
            }
        }
        e.removeClass('on').addClass('off');
    });

    // We are able to get GPS position on idevices, if the user allows
    // The position is displayed in top right corner of the screen
    // This should be very handly for in the field tracking
    //setTimeout(function() {updateCurrentPosition(50.27533, 3.335166);}, 5000);
    if(navigator.geolocation) {
        // if we have geolocation services, show the locate me button
        // the button pants the map to the user current location
        if(is_mobile && !wvar.enabled) $(".chasecar").show();
        $("#locate-me,#app_name").attr('style','').click(function() {
            if(map && currentPosition) {
                // disable following of vehicles
                stopFollow();
                // open map
                $('.nav .home').click();
                // pan map to our current location
                map.panTo(new google.maps.LatLng(currentPosition.lat, currentPosition.lon));

                //analytics
                if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'Functionality', 'Locate me']);
            } else {
                alert("No position available");
            }
        });

        navigator.geolocation.getCurrentPosition(positionUpdateHandle);
        // check for location update every 30sec
        //setInterval(positionUpdateHandle, 30000);
        // immediatelly check for position
        //positionUpdateHandle();
    }

    // weather feature

    // list of overlays
    var overlayList = [
        ['Global', [
            ['google-radar','Google Earth Radar'],
            ['nrl-global-cloudtop','NRL Monterey Cloudtop'],
            ['nrl-global-ir','NRL Monterey IR'],
            ['nrl-global-vapor','NRL Monterey Vapor']
        ]],
        ['Europe/Africa', [
            ['meteosat-Odeg-MPE', 'METEOSAT Precip. Estimate']
        ]],
        ['Indian Ocean', [
            ['meteosat-iodc-MPE', 'METEOSAT IODC Precip. Est.']
        ]],
        ['North America', [
            ['nexrad-n0q-900913', 'NEXRAD Base Reflectivity'],
            ['goes-ir-4km-900913', 'GOES NA Infrared ~4km'],
            ['goes-wv-4km-900913', 'GOES NA Water Vapor ~4km'],
            ['goes-vis-1km-900913', 'GOES NA Visible ~1km'],
            ['goes-east-ir-4km-900913', 'GOES East CONUS Infrared'],
            ['goes-east-wv-4km-900913', 'GOES East CONUS Water Vapor'],
            ['goes-east-vis-1km-900913', 'GOES East CONUS Visible'],
            ['goes-west-ir-4km-900913', 'GOES West CONUS Infrared'],
            ['goes-west-wv-4km-900913', 'GOES West CONUS Water Vapor'],
            ['goes-west-vis-1km-900913', 'GOES West CONUS Visible'],
            ['hawaii-vis-900913', 'GOES West Hawaii Visible'],
            ['alaska-vis-900913', 'GOES West Alaska Visible'],
            ['alaska-ir-900913', 'GOES West Alaska IR'],
            ['alaska-wv-900913', 'GOES West Alaska Water Vapor'],
            ['q2-n1p-900913', 'Q2 1 Hour Precipitation'],
            ['q2-p24h-900913', 'Q2 24 Hour Precipitation'],
            ['q2-p48h-900913', 'Q2 48 Hour Precipitation'],
            ['q2-p72h-900913', 'Q2 72 Hour Precipitation'],
            ['q2-hsr-900913', 'MRMS Hybrid-Scan Reflectivity Composite.']
        ]]
    ];

    // generate the list of switches for each overlay
    var elm = $("#weatherbox .slimContainer");
    var j;
    for(j in overlayList) {
        var region = overlayList[j][0];
        var switches = overlayList[j][1];

        elm.append("<h4>"+region+"</h4><hr>");

        var i;
        for(i in switches) {
            var id = switches[i][0];
            var name = switches[i][1];

            var html = '<div class="row option">'
                     + '<span><b>'+name+'</b></span>'
                     + '<div class="switch off" id="sw_weather_'+id+'">'
                     + '<span class="thumb"></span>'
                     + '<input type="checkbox" id="opt_weather_'+id+'">'
                     + '</div>'
                     + '</div>';

            elm.append(html);
        }
    }

    // the magic that makes the switches do things
    elm.find(".switch").click(function() {
        var e = $(this);
        var name = e.attr('id').replace('sw', 'opt');
        var id = name.replace("opt_weather_","");
        var on;

        if(e.hasClass('on')) {
            e.removeClass('on').addClass('off');
            on = 0;
        } else {
            // only one overlay at a time
            $("#weatherbox .switch").removeClass('on').addClass('off');
            e.removeClass('off').addClass('on');
            on = 1;
        }

        weatherImageOverlay.setMap(null);
        weatherGoogleRadar.setMap(null);
        map.overlayMapTypes.setAt("0", null);

        if(on) {
            if(id == "google-radar") {
                weatherGoogleRadar.setMap(map);
                return;
            } else if(id in weatherImageOverlayList) {
                var o = weatherImageOverlayList[id];
                var sw = new google.maps.LatLng(o[1][0][0], o[1][0][1]);
                var ne = new google.maps.LatLng(o[1][1][0], o[1][1][1]);
                var bounds = new google.maps.LatLngBounds(sw, ne);
                weatherImageOverlay = new google.maps.GroundOverlay(o[0], bounds, {opacity: 0.7});
                weatherImageOverlay.setMap(map);
                return;
            }

            weatherOverlayId = id;
            map.overlayMapTypes.setAt("0", weatherOverlay);
        }
   });
});
