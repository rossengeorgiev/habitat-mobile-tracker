var listScroll;
var nLoadedImages = 0;
var preloadTimer;
var preloadImages = [ 
    "img/logo.png",    
    "img/marker-you.png",    
];
var GPS_ts = null;
var GPS_lat = null;
var GPS_lon = null;
var GPS_alt = null;
var GPS_speed = null;
var CHASE_enabled = false;
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
        $('#main,#map').height(h-hh-5);
        $('body').height(h);
        $('#map').width(w-sw-1);
    } else { // portrait mode
        if(h < 420) h = 420;
        $('body').height(h);
        $('#map').height(h-hh-5-180);
        $('#map').width(w);
        $('#main').height(180); // 180px is just enough to hold one expanded vehicle
    }

    if(map) map.checkResize();
}

window.onresize = checkSize;
window.onchangeorientation = checkSize;



$(window).ready(function() {
    // resize elements if needed
    checkSize();

    // add inline scroll to vehicle list
    listScroll = new iScroll('main', { hScrollbar: false, hScroll: false, snap: false });

    // expand list items
    $('#main').on('click', '.row .header', function() {
        var e = $(this).parent();
        if(e.hasClass('active')) {
            // collapse data for selected vehicle
            e.removeClass('active');
            e.find('.data').hide();

            listScroll.refresh();
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
            panTo(parseInt(e.attr('class').match(/vehicle(\d+)/)[1]));
        }
    });

    // menu interface options
    $('.nav')
    .on('click', '.home', function() {
        var e = $(this);
        var box = $('#main,#map');
        if(box.is(':hidden')) {
            $('#chasecarbox,#aboutbox').hide();
            box.show();
        }
        checkSize();
    })
    .on('click', '.chasecar', function() {
        var e = $(this);
        var box = $('#chasecarbox');
        if(box.is(':hidden')) {
            $('#map,#main,#aboutbox').hide();
            box.show();
        }
        checkSize();
    })
    .on('click', '.about', function() {
        var e = $(this);
        var box = $('#aboutbox');
        if(box.is(':hidden')) {
            $('#map,#main,#chasecarbox').hide();
            box.show();
        }
        checkSize();
    });

    // toggle functionality for switch button
    $(".switch").click(function() {
        var e = $(this);
        var field = $('#cc_callsign');

        // turning the switch off
        if(e.hasClass('on')) {
            field.removeAttr('disabled');
            e.removeClass('on').addClass('off');

            CHASE_enabled = false;

            // blue man reappers :)
            if(currentPosition && currentPosition.marker) currentPosition.marker.show(); 
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
                //ChaseCar.putListenerInfo(callsign);
                CHASE_listenerSent = true;
            }
            // if already have a position push it to habitat
            if(GPS_ts) {
                ChaseCar.updatePosition(callsign, { coords: { latitude: GPS_lat, longitude: GPS_lon, altitude: GPS_alt, speed: GPS_speed }});
            }
            CHASE_enabled = true;

            // hide the blue man
            if(currentPosition && currentPosition.marker) currentPosition.marker.hide(); 
        }
    });

    // remember callsign as a cookie
    $("#cc_callsign").on('change keyup', function() {
        callsign = $(this).val().trim();
        document.cookie = "mtCallsign=" + callsign + "; expires=Fri, 13 Jul 2033 03:33:33 UTC; path=/";
        CHASE_listenerSent = false;
    });

    // read callsign cookie and load the value
    var cookiejar = document.cookie.split(";");

    for (var i = 0; i < cookiejar.length; i++) {
        var cookie = cookiejar[i].split('=');
        if(cookie[0] == "mtCallsign") {
            callsign = cookie[1];
            $('#cc_callsign').val(callsign);
            break;
        }
    }

    // We are able to get GPS position on idevices, if the user allows
    // The position is displayed in top right corner of the screen
    // This should be very handly for in the field tracking 
    //setTimeout(function() {updateCurrentPosition(50.27533, 3.335166);}, 5000);
    if(navigator.geolocation) {
        // if we have geolocation services, show the locate me button
        // the button pants the map to the user current location
        $("#locate-me,.chasecar").show();
        $("#locate-me").click(function() {
            if(map && currentPosition) {
                $('.nav .home').click();
                map.panTo(new GLatLng(currentPosition.lat, currentPosition.lon));    
            } else {
                alert("No position available");
            }
        });

        setInterval(function() {
            navigator.geolocation.getCurrentPosition(function(position) {
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
                if(GPS_lat != lat
                   || GPS_lon != lon
                   || GPS_alt != alt
                   || GPS_speed != speed)
                {
                    GPS_lat = lat;
                    GPS_lon = lon;
                    GPS_alt = alt;
                    GPS_speed = speed;
                    GPS_ts = parseInt(position.timestamp/1000);
                    $('#cc_timestamp').text('just now');

                    if(CHASE_enabled) {
                        ChaseCar.updatePosition(callsign, position);
                    }
                }
                else { return; }

                // add/update marker on the map (tracker.js)
                updateCurrentPosition(lat, lon);
                 
                // round the coordinates
                lat = parseInt(lat * 1000000)/1000000;
                lon = parseInt(lon * 1000000)/1000000;

                // dispaly them in the top right corner
                $('#app_name b').html(lat + '<br/>' + lon);

                // update chase car interface
                $('#cc_lat').text(lat);
                $('#cc_lon').text(lon);
                $('#cc_alt').text(alt + " m");
                $('#cc_accuracy').text(accuracy + " m");
                $('#cc_speed').text(speed + " m/s");
            }, 
            function() {
                // when there is no location
                $('#app_name b').html('mobile<br/>tracker');
            });
        }, 30000);
    }

    // preload images
    for(var i = 0, ii = preloadImages.length; i < ii; i++) {
        var image = new Image();
        image.onLoad = (function() { nLoadedImages++; })();
        image.src = preloadImages[i];
    }

    // check if images have loaded
    preloadTimer = setInterval(function() {
        if(nLoadedImages < preloadImages.length) return;
        clearInterval(preloadTimer);

        // app stars with a welcome screen
        // after images are loaded we can show the interface
        setTimeout(function() {
            $('#loading').hide(); // welcome screen
            $('header,#main,#map').show(); // interface elements
        }, 500);
    }, 100);
});
