// detect if mobile
var is_mobile = false;

(function(a,b){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) is_mobile = true;})(navigator.userAgent||navigator.vendor||window.opera);

// hash url
var history_supported = (typeof history !== 'undefined');

function lhash_update(history_step) {
    history_step = !!history_step;

    var url = document.location.href.split("#",1)[0];
    var hash = "";

    // generate hash
    hash += "mt=" + map.getMapTypeId();
    hash += "&mz=" + map.getZoom();

    if(!/^[a-z0-9]{32}$/ig.exec(wvar.query)) {
        hash += "&qm=" + wvar.mode.replace(/ /g, '_');
    }

    if(follow_vehicle === null || manual_pan) {
        var latlng = map.getCenter();
        hash += "&mc=" + roundNumber(latlng.lat(), 5) +
                "," + roundNumber(latlng.lng(), 5);
    }

    if(follow_vehicle !== null) {
        hash += "&f=" + follow_vehicle;
    }

    if(wvar.query !== "") {
        hash += "&q=" + wvar.query;
        $("header .search input[type='text']").val(wvar.query);
    }

    // other vars
    if(wvar.nyan) {
        hash += "&nyan=1";
    }

    hash = encodeURI(hash);
    // set state
    if(history_supported) {
        if(!history_step) {
            history.replaceState(null, null, url + "#!" + hash);
        } else {
            history.pushState(null, null, url + "#!" + hash);
        }
    } else {
        document.location.hash = "!" + hash;
    }
}

// wvar detection
var wvar = {
    enabled: false,
    vlist: true,
    graph: true,
    graph_exapnded: false,
    focus: "",
    mode: (is_mobile) ? modeDefaultMobile : modeDefault,
    zoom: true,
    query: "!RS_*;",
    nyan: false,
};


function load_hash(no_refresh) {
    no_refresh = (no_refresh === null);
    var hash = window.location.hash.slice(2);

    if(hash === "") return;

    var parms = hash.split('&');
    var refresh = false;
    var refocus = false;

    // defaults
    manual_pan = false;

    var def = {
        mode: wvar.mode,
        zoom: true,
        focus: "",
        query: "",
        nyan: false,
    };

    parms.forEach(function(v) {
        v = v.split('=');
        k = v[0];
        v = decodeURIComponent(v[1]);

        switch(k) {
            case "mt":
                map.setMapTypeId(v);
                break;
            case "mz":
                map.setZoom(parseInt(v));
                break;
            case "mc":
                def.zoom = false;
                manual_pan = true;
                v = v.split(',');
                var latlng = new google.maps.LatLng(v[0], v[1]);
                map.setCenter(latlng);
                break;
            case "f":
                refocus = (follow_vehicle != v);
                follow_vehicle = v;
                def.focus = v;
                break;
            case "qm":
                def.mode = v.replace(/_/g, ' ');
                if(modeList.indexOf(def.mode) == -1) def.mode = (is_mobile) ? modeDefaultMobile : modeDefault;
                break;
            case "q":
                def.query = v;
                $("header .search input[type='text']").val(v);
                break;
            case "nyan":
                def[k] = !!parseInt(v);
                break;
        }
    });

    // check if we should force refresh
    ['mode','query','nyan'].forEach(function(k) {
        if(wvar[k] != def[k]) refresh = true;
    });

    $.extend(true, wvar, def);

    // force refresh
    if(!no_refresh) {
       if(refresh) {
           zoomed_in = false;
           clean_refresh(wvar.mode, true);
       }
       else if(refocus) {
           $(".row.active").removeClass('active');
           $(".vehicle"+vehicles[wvar.focus].uuid).addClass('active');
           followVehicle(wvar.focus, manual_pan, true);
       }
    }

    lhash_update();
}
window.onhashchange = load_hash;

var params = window.location.search.substring(1).split('&');

for(var idx in params) {
    var line = params[idx].split('=');
    if(line.length < 2) continue;

    switch(line[0]) {
        case "embed":
            if(line[1] == "1") {
                wvar.enabled = true;
                if(!is_mobile) wvar.mode = 'All';
            }
            break;
        case "hidelist": if(line[1] == "1") wvar.vlist = false; break;
        case "hidegraph": if(line[1] == "1") wvar.graph = false; break;
        case "expandgraph": if(line[1] == "1") wvar.graph_expanded = true; break;
        case "filter":
            wvar.query = decodeURIComponent(line[1]);
            $("header .search input[type='text']").val(wvar.query);
            break;
        case "nyan": wvar.nyan = true; break;
        case "focus": wvar.focus = decodeURIComponent(line[1]); break;
        case "docid": wvar.docid = line[1]; break;
        case "mode": wvar.mode = decodeURIComponent(line[1]); break;
    }
}

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
        } catch(v) {}

        window.location.reload();
        return;
    }

    $('#loading .complete').stop(true,true).animate({width: 200}, {complete: trackerInit });
};

var hysplit = {};
var hysplit_data = {};
var refresh_hysplit = function() {
    $.getJSON("//spacenear.us/tracker/datanew.php?type=hysplit&format=json", function(data) {
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
};

// loads the tracker interface
function trackerInit() {
    $('#loading,#settingsbox,#aboutbox,#chasebox').hide(); // welcome screen
    $('header,#main').show(); // interface elements
    checkSize();

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
var CHASE_timer = 0;
var callsign = "";

function checkSize() {
    // we are in landscape mode
    w = window.innerWidth;

    // this is hacky fix for off by 1px that makes the vechicle list disappear
    wrect = document.body.getBoundingClientRect();
    // chrome seems to calculate the body bounding box differently from every other browser
    if (!!window.chrome) {
        w_fix = (w >= wrect.width) ? 1 : 0;
    } else {
        w_fix = (w === Math.floor(wrect.width)) ? 0 : 1;
    }

    w = (w < 320) ? 320 :  w; // absolute minimum 320px
    h = window.innerHeight;
    //h = (h < 300) ? 300 :  h; // absolute minimum 320px minus 20px for the iphone bar
    hh = $('header').height();

    ph = 0;

    if(w > 900 && $('.flatpage:visible').length) {
        $('.flatpage').addClass('topanel');
        ph = $('.flatpage:visible').width()+30;
    } else {
        $('.flatpage.topanel').removeClass('topanel');
    }

    $("#mapscreen,.flatpage").height(h-hh-5);

    sw = (wvar.vlist) ? 200 : 0;

    $('.container').width(w-20);

    if($('.landscape:visible').length) {
        $('#main').height(h-hh-5);
        if($('#telemetry_graph .graph_label').hasClass('active')) {
            $('#map').height(h-hh-5-200);
        } else {
            $('#map').height(h-hh-5);
        }
        $('body,#loading').height(h);
        $('#mapscreen,#map,#telemetry_graph,#telemetry_graph .holder').width(w-sw-ph-w_fix);
        $('#main').width(sw);
    } else { // portrait mode
        //if(h < 420) h = 420;
        var mh = (wvar.vlist) ? 150 : 0;

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
                                    ((hours)?hours+'h ':'') +
                                    ((minutes)?minutes+'m':'') +
                                    ' ago'
                                : 'just now';
                $('#cc_timestamp').text(ts_str);
            }, 30000);

            $('#cc_timestamp').text('just now');
        }

        // save position and update only if different is available
        if(CHASE_timer < (new Date()).getTime() &&
           (
           GPS_lat != lat ||
           GPS_lon != lon ||
           GPS_alt != alt ||
           GPS_speed != speed
           )
        )
        {
            GPS_lat = lat;
            GPS_lon = lon;
            GPS_alt = alt;
            GPS_speed = speed;
            GPS_ts = parseInt(position.timestamp/1000);
            $('#cc_timestamp').text('just now');

            // update look angles once we get position
            if(follow_vehicle !== null && vehicles[follow_vehicle] !== undefined) {
                update_lookangles(follow_vehicle);
            }

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
};

var twoZeroPad = function(n) {
    n = String(n);
    return (n.length<2) ? '0'+n : n;
};

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

    elm.find(".current").text("UTC: "+a+'-'+b+'-'+c+' '+e+':'+f+':'+g);

    a = date.getFullYear();
    b = twoZeroPad(date.getMonth()+1); // months 0-11
    c = twoZeroPad(date.getDate());
    e = twoZeroPad(date.getHours());
    f = twoZeroPad(date.getMinutes());
    g = twoZeroPad(date.getSeconds());
    z = date.getTimezoneOffset() / -60;

    elm.find(".local").text("Local: "+a+'-'+b+'-'+c+' '+e+':'+f+':'+g+" "+((z<0)?"-":"+")+z);
};

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
};

// runs every second
var updateTime = function(date) {
    // update timebox
    var elm = $("#timebox.present");
    if(elm.length > 0) updateTimebox(date);

    // update friendly delta time fields
    elm = $(".friendly-dtime");
    if(elm.length > 0) {
        var now = new Date().getTime();

        elm.each(function(k,v) {
            var e = $(v);
            if(e.attr('data-timestamp') === undefined) return;
            var ts = e.attr('data-timestamp');
            var str = format_time_friendly(ts, now);
            if(str) e.text(str + ' ago');
        });
    }
};


$(window).ready(function() {
    // refresh timebox
    setInterval(function() {
        updateTime(new Date());
    }, 1000);

    // resize elements if needed
    checkSize();

    // add inline scroll to vehicle list
    listScroll = new IScroll('#main', {
        hScrollbar: false,
        hScroll: false,
        snap: false,
        mouseWheel: true,
        scrollbars: true,
        scrollbarClass: 'scrollStyle',
        shrinkScrollbars: 'scale',
        tap: true,
        click: true,
        disableMouse: false,
        disableTouch: false,
        disablePointer: false,
    });

    $('#telemetry_graph').on('click', '.graph_label', function() {
        var e = $(this), h;
        if(e.hasClass('active')) {
            e.removeClass('active');
            h = $('#map').height() + $('#telemetry_graph').height();

            plot_open = false;

            //analytics
            if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'UI', 'Collapse', 'Telemetry Graph']);
        } else {
            e.addClass('active');
            h = $('#map').height() - $('#telemetry_graph').height();

            plot_open = true;

            //analytics
            if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'UI', 'Expand', 'Telemetry Graph']);
        }
        $('#map').stop(null,null).animate({'height': h}, function() {
            if(map) google.maps.event.trigger(map, 'resize');

            if(plot_open &&
               follow_vehicle !== null &&
               (follow_vehicle != graph_vehicle || vehicles[follow_vehicle].graph_data_updated)) updateGraph(follow_vehicle, true);
        });
    });

    // expand graph on startup, if nessary
    if(wvar.graph_expanded) $('#telemetry_graph .graph_label').click();

    // hysplit button
    $("#main").on('click','.row .data .vbutton.hysplit', function(event) {
        event.stopPropagation();

        var elm = $(this);
        var name = elm.attr('data-vcallsign');

        if(elm.hasClass("active")) {
            elm.removeClass('active');
            hysplit[name].setMap(null);
        }
        else {
            elm.addClass('active');
            hysplit[name].setMap(map);
        }
    });

    $("#main").on('click','.row .data .vbutton.path', function(event) {
        event.stopPropagation();

        var elm = $(this);
        var name = elm.attr('data-vcallsign');

        if(elm.hasClass("active")) {
            elm.removeClass('active');
            set_polyline_visibility(name, false);
        }
        else {
            elm.addClass('active');
            set_polyline_visibility(name, true);
        }
    });

    // reset nite-overlay and timebox when mouse goes out of the graph box
    $("#telemetry_graph").on('mouseout','.holder', function() {
        if(plot_crosshair_locked) return;

        updateGraph(null, true);
    });

    // hand cursor for dragging the vehicle list
    $("#main").on("mousedown", ".row", function () {
        $("#main").addClass("drag");
    });
    $("body").on("mouseup", function () {
        $("#main").removeClass("drag");
    });

    // confirm dialog when launchnig a native map app with coordinates
    //$('#main').on('click', '#launch_mapapp', function() {
    //    var answer = confirm("Launch your maps app?");

    //    //analytics
    //    if(typeof _gaq == 'object') _gaq.push(['_trackEvent', 'Functionality', ((answer)?"Yes":"No"), 'Coord Click']);

    //    return answer;
    //});

    // follow vehicle by clicking on data
    $('#main').on('click', '.row .data', function() {
        var e = $(this).parent();

        followVehicle(e.attr('data-vcallsign'));
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
            if(follow_vehicle !== null && follow_vehicle == e.attr('data-vcallsign')) {
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
            followVehicle(e.attr('data-vcallsign'));
        }
    });

    // menu interface options
    $('.nav')
    .on('click', 'li', function() {
        var e = $(this);
        var name = e.attr('class').replace(" last","");

        // makes the menu buttons act like a switch
        if($("#"+name+"box").is(':visible')) name = 'home';

        var box = $("#"+name+"box");

        if(box.is(':hidden')) {
            $('.flatpage, #homebox').hide();
            box.show().scrollTop(0);

            if(name == 'about' && !$('#motd').hasClass('inited')) {
                $('#motd').addClass('inited');

                $.getJSON("//spacenear.us/tracker/datanew.php?type=info", function(data) {
                    if('html' in data) $('#motd').html(data.html.replace(/\\/g,''));
                });

                var iframe = box.find('iframe');
                var src = iframe.attr('data-src');
                iframe.attr('src', src);
            }

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
        "#sw_layers_aprs",
        "#sw_offline",
        "#sw_station",
        "#sw_imperial",
        "#sw_haxis_hours",
        "#sw_daylight",
        "#sw_hide_receivers",
        "#sw_hide_timebox",
        "#sw_hilight_vehicle",
        '#sw_hide_horizon',
        "#sw_nowelcome",
        "#sw_interpolate",
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
                else focusVehicle(null, true);
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
            case "opt_hide_horizon":
                if(on) {
                    hideHorizonRings();
                }
                else {
                    showHorizonRings();
                }
                break;
            case "opt_layers_aprs":
                if(on) map.overlayMapTypes.setAt("1", overlayAPRS);
                else map.overlayMapTypes.setAt("1", null);
                break;
            case "opt_interpolate":
                if(on) { graph_gap_size = graph_gap_size_max; }
                else { graph_gap_size = graph_gap_size_default; }
                clean_refresh(wvar.mode, true, false);
                break;
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
            } catch (v) {
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

            var html = '<div class="row option">' +
                     '<span><b>'+name+'</b></span>' +
                     '<div class="switch off" id="sw_weather_'+id+'">' +
                     '<span class="thumb"></span>' +
                     '<input type="checkbox" id="opt_weather_'+id+'">' +
                     '</div>' +
                     '</div>';

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

   $("header .search form").on('submit', function(e) {
       e.preventDefault();

       var text = $("header .search input[type='text']").val();

       if(text === wvar.query) return;

       // when running an empty search, it's probably best to reset the query mode

       wvar.query = text;
       stopFollow();
       zoomed_in = false;
       wvar.zoom = true;

       if(text === "") { wvar.mode = null; }
       clean_refresh(wvar.mode, true, true);
   });
});
