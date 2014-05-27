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

$.ajaxSetup({ cache: true });

// handle cachin events and display a loading bar
var loadReload = false;
var loadComplete = function(e) {
    clearTimeout(initTimer);

    if(loadReload && e.type == 'updateready') {
        if(confirm("Reload app?")) {
            window.location.href = window.location.href;
            return;
        }
    }

    loadReload = false;

    $('#loading .complete').stop(true,true).animate({width: 200}, {complete: trackerInit });
}

// loads the tracker interface
function trackerInit() {
    $('#loading,#settingsbox,#aboutbox,#chasebox').hide(); // welcome screen
    $('header,#main,#map').show(); // interface elements

    if(!is_mobile) {
        $.getScript("js/ssdv.js");
        $.getScript("js/init_plot.js", function() { checkSize(); if(!map) load(); });
        $('#telemetry_graph').addClass("main_screen").attr('style','');
        return;
    }
    checkSize();
    if(!map) load();
}

// if for some reason, applicationCache is not working, load the app after a 3s timeout
var initTimer = setTimeout(trackerInit, 3000);

var cache = window.applicationCache;
cache.addEventListener('checking', function() { clearTimeout(initTimer); $('#loading .bar,#loading').show(); $('#loading .complete').css({width: 0}); }, false);
cache.addEventListener('noupdate', loadComplete, false);
cache.addEventListener('updateready', loadComplete, false);
cache.addEventListener('cached', loadComplete, false);
cache.addEventListener('error', loadComplete, false);
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
    h = (h < 300) ? 300 :  h; // absolute minimum 320px minus 20px for the iphone bar
    hh = $('header').height();
    sw = $('#main').width();

    $('.container').width(w-20);

    if($('.landscape:visible').length) {
        $('#main').height(h-hh-5);
        if($('#telemetry_graph .graph_label').hasClass('active')) {
            $('#map').height(h-hh-5-200);
        } else {
            $('#map').height(h-hh-5);
        }
        $('body,#loading').height(h);
        $('#map,#telemetry_graph,#telemetry_graph .holder').width(w-sw-1);
    } else { // portrait mode
        if(h < 420) h = 420;
        $('body,#loading').height(h);
        $('#map').height(h-hh-5-180);
        $('#map').width(w);
        $('#main').height(180); // 180px is just enough to hold one expanded vehicle
    }

    // this should hide the address bar on mobile phones, when possible
    window.scrollTo(0,1);
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

            if(CHASE_enabled) {
                ChaseCar.updatePosition(callsign, position);
                CHASE_timer = (new Date()).getTime() + 15000;
            }
        }
        else { return; }

        // add/update marker on the map (tracker.js)
        updateCurrentPosition(lat, lon);

        // round the coordinates
        lat = parseInt(lat * 1000000)/1000000;  // 6 decimal places
        lon = parseInt(lon * 1000000)/1000000;  // 6 decimal places
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



$(window).ready(function() {
    // resize elements if needed
    checkSize();

    // add inline scroll to vehicle list
    listScroll = new iScroll('main', { hScrollbar: false, hScroll: false, snap: false, scrollbarClass: 'scrollStyle' });

    $('#telemetry_graph').on('click', '.graph_label', function() {
        var e = $(this);
        if(e.hasClass('active')) {
            e.removeClass('active');
            var h = $('#map').height() + $('#telemetry_graph').height();
        } else {
            e.addClass('active');
            var h = $('#map').height() - $('#telemetry_graph').height();
        }
        $('#map').stop(null,null).animate({'height': h}, function() {
            if(map) google.maps.event.trigger(map, 'resize');
        });
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
        return confirm("Launch your maps app?");
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
                followVehicle(parseInt(e.attr('class').match(/vehicle(\d+)/)[1]));
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
    .on('click', '.home', function() {
        var e = $(this);
        var box = $('.main_screen');
        if(box.is(':hidden')) {
            $('#chasecarbox,#aboutbox,#settingsbox').hide();
            box.show();
        }
        checkSize();
    })
    .on('click', '.chasecar', function() {
        var e = $(this);
        var box = $('#chasecarbox');
        if(box.is(':hidden')) {
            $('.main_screen,#aboutbox,#settingsbox').hide();
            box.show();
        }
        checkSize();
    })
    .on('click', '.about', function() {
        var e = $(this);
        var box = $('#aboutbox');
        if(box.is(':hidden')) {
            $('.main_screen,#chasecarbox,#settingsbox').hide();
            box.show();
        }
        checkSize();
    })
    .on('click', '.settings', function() {
        var e = $(this);
        var box = $('#settingsbox');
        if(box.is(':hidden')) {
            $('.main_screen,#chasecarbox,#aboutbox').hide();
            box.show();
        }
    });

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
            }

            if(navigator.geolocation) CHASE_enabled = navigator.geolocation.watchPosition(positionUpdateHandle, positionUpdateError);
            //CHASE_enabled = true;

            // hide the blue man
            if(currentPosition && currentPosition.marker) currentPosition.marker.setVisible(false);
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

    // daylight overlay
    $('#sw_daylight').click(function() {
        var e = $(this);
        var name = e.attr('id').replace('sw', 'opt');
        var on;

        if(e.hasClass('on')) {
            e.removeClass('on').addClass('off');
            on = 0;
            nite.hide();
        } else {
            e.removeClass('off').addClass('on');
            on = 1;
            nite.show();
        }

        offline.set(name, on);
    });

    if(offline.get('opt_daylight')) $('#sw_daylight').removeClass('off').addClass('on');

    // offline and mobile
    $('#sw_offline, #sw_station, #sw_imperial').click(function() {
        var e = $(this);
        var name = e.attr('id').replace('sw', 'opt');
        var on;

        if(e.hasClass('on')) {
            e.removeClass('on').addClass('off');
            on = 0;
        } else {
            e.removeClass('off').addClass('on');
            on = 1;
        }

        offline.set(name, on);
        if(name == "opt_imperial") refreshUI();
    });

    if(offline.get('opt_offline')) $('#sw_offline').removeClass('off').addClass('on');
    if(offline.get('opt_station')) $('#sw_station').removeClass('off').addClass('on');
    if(offline.get('opt_imperial')) $('#sw_imperial').removeClass('off').addClass('on');

    // force re-cache
    $('#sw_cache').click(function() {
        var e = $(this).removeClass('off').addClass('on');
        if(confirm("Force re-cache?")) {
            window.scrollTo(0,1);
            $("#settingsbox").hide();
            loadReload = true;
            applicationCache.update();
        }
        e.removeClass('on').addClass('off');
    });

    // We are able to get GPS position on idevices, if the user allows
    // The position is displayed in top right corner of the screen
    // This should be very handly for in the field tracking
    //setTimeout(function() {updateCurrentPosition(50.27533, 3.335166);}, 5000);
    if(navigator.geolocation && is_mobile) {
        // if we have geolocation services, show the locate me button
        // the button pants the map to the user current location
        $("#locate-me,.chasecar").show();
        $("#locate-me").click(function() {
            if(map && currentPosition) {
                // disable following of vehicles
                stopFollow();
                // open map
                $('.nav .home').click();
                // pan map to our current location
                map.panTo(new google.maps.LatLng(currentPosition.lat, currentPosition.lon));
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
});
