var listScroll;

function hideAddressbar()
{
    window.scrollTo(0, 1);
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
            e.removeClass('active');
            e.find('.data').slideUp();
        } else {
            e.addClass('active');
            e.find('.data').slideDown();
        }
        listScroll.refresh();
    });
});
