var listScroll;
var nLoadedImages = 0;
var preloadTimer;
var preloadImages = [ 
    "img/logo.png",    
    "img/marker-you.png",    
    "img/menu-icons.png",    
];

function hideAddressbar()
{
    window.scrollTo(0, 1);
}

function checkPreload() {
}


$(window).ready(function() {
    window.onorientationchange = hideAddressbar();
    listScroll = new iScroll('main', { hScrollbar: false, snap: true });

    // click first icon for popup with the window size
    $('.home').click(function() {
        var size = "";
        size += $(window).width();
        size += "x";
        size += $(window).height();

        alert(size);
    });

    // reload page when station icon is clicked
    $('.stations').click(function() {
        window.location.href = window.location.href;
    });

    // expand list items
    $('#main').on('click', '.row .header', function() {
        var e = $(this).parent();
        if(e.hasClass('active')) {
            // collapse data for selecte vehicle
            e.removeClass('active');
            e.find('.data').hide();

            listScroll.refresh();
        } else {
            // expand data for select vehicle
            e.addClass('active');
            e.find('.data').show();

            listScroll.refresh();
            
            // auto scroll when expanding an item
            var eName = "." + e.parent().attr('class') + " ." + e.attr('class').match(/vehicle\d+/)[0];
            listScroll.scrollToElement(eName);
            
            // pan to selected vehicle
            panTo(parseInt(e.attr('class').match(/vehicle(\d+)/)[1]));
        }
    });

    // We are able to get GPS position on idevices, if the user allows
    // The position is displayed in top right corner of the screen
    // This should be very handly for in the field tracking 
    //setTimeout(function() {updateCurrentPosition(50.27533, 3.335166);}, 5000);
    if(navigator.geolocation) {
        setInterval(function() {
            navigator.geolocation.getCurrentPosition(function(position) {
               var lat = position.coords.latitude;
               var long = position.coords.longitude;

               // add marker on the map
               updateCurrentPosition(lat, long);
                
               // round the coordinates
               lat = parseInt(lat * 1000000)/1000000;
               long = parseInt(long * 1000000)/1000000;

               $('#app_name b').html(lat + '<br/>' + long);
            }, 
            function() {
               $('#app_name b').html('mobile<br/>tracker');
            });
        }, 10000); // poll every 10sec;
    }

    // preload images
    var i = 0;
    for(i = 0; i < preloadImages.length; i++) {
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
            $('#loading').hide();
            $('header,#main,#map').show();
        }, 500);
    }, 100);
});
