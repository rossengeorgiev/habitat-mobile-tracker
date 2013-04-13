var ssdv_url = "http://ssdv.habhub.org/data.php?callback=?&format=jsonp&request=update&last_id=";
var ssdv_last_id = 0;
var ssdv_timer = ssdv_timer || null;
var ssdv_html = "<div id='ssdv' style='z-index: 20;position:absolute;bottom:0px;right:0px;width:320px'>" +
                 "<span class='label' style='z-index:21;display:block;width:100%;background:#00a3d3;height:20px;padding:3px 5px;font-weight: bold;font-size: 11px;color:#fff;border-radius:5px 0 0 0;box-shadow:1px -1px 5px rgba(0,0,0,0.2);cursor:pointer;'>SSDV</span>" +
                 "<img src='' style='height:0px;display:none'/>" +
                 "<span class='link' style='display:none;position:absolute;bottom:0px;right:0px;border-radius:5px 0 0 0;padding:0px 4px;background:rgba(0,0,0,0.2);color:#ccc;font-size:10px'>powered by <a style='color:#fff' href='http://ssdv.habhub.org'>ssdv.habhub.org</a></span>" +
                 "</div>";



$('#ssdv .label').live('click',function() {
    var img = $('#ssdv img');
    var poweredby = $('#ssdv .link');

    if(img.is(':visible')) {
        poweredby.fadeOut();
        img.animate({'height':0}, function() { $(this).hide() });
    } else {
        img.show().width(320).animate({'height':240}, function() { poweredby.fadeIn() }).css({'display':'block'});
    }
});

var jsonp_callback = function(data) {
    if($('#ssdv').length == 0) $('#map').append(ssdv_html);

    if(data.images.length > 0) {
        var img = data.images[0];
        var time = new Date();
        time.setTime((img.updated + (new Date()).getTimezoneOffset()) * 1000);
        var minutes = Math.floor(((new Date()).getTime() - time.getTime()) / 60000);

        $('#ssdv .label').text("SSDV from " + img.payload + " " + img.received_packets + "/" + img.lost_packets + " updated "+minutes+" min ago");
        $('#ssdv img').attr('src', 'http://ssdv.habhub.org' + img.image);
    }

    ssdv_last_id = data.last_id;
};

var ssdv_fetch = function() {
    $.getJSON(ssdv_url + ssdv_last_id);
}

setTimeout(ssdv_fetch, 2000);
clearInterval(ssdv_timer);
ssdv_timer = setInterval(ssdv_fetch, 16000);
