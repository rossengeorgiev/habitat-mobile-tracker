habitat.util = {
    timestamp_now: function() {
        return Math.floor((new Date()).getTime() / 1000);
    },
    rfc3339_to_timestamp: function(str) {
        if(typeof str != "string") return null;

        return Math.floor((new Date(str)).getTime() / 1000);
    },
    timestamp_to_rfc3339: function(ts) {
        if(typeof str != "int") return null;

        var date = new Date();
        date.setTime(ts * 1000);

        return date.toISOString();
    }
};
