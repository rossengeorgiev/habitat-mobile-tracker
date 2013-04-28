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

    // this should hide the address bar on some mobile phones
    window.scrollTo(0,1);
}

window.onresize = checkSize;
window.onchangeorientation = checkSize;

$(window).ready(function() {
    // resize elements if needed
    checkSize();

    // add inline scroll to vehicle list
    listScroll = new iScroll('main', { hScrollbar: false, hScroll: false, snap: false, scrollbarClass: 'scrollStyle' });
});
