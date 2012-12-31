function hideAddressbar()
{
    window.scrollTo(0, 1);
}

$(window).ready(function() {
    window.onorientationchange = hideAddressbar();

    $('.home').click(function() {
        var size = "";
        size += $(window).width();
        size += "x";
        size += $(window).height();

        alert(size);
    });

    $('.stations').click(function() {
        window.location.href = window.location.href;
    });
});
