habitat.tracker = {
    flights: { active: [], upcoming: [] },
    options: {},
    vehicles: [],


    // reset tracker state to pre-init state
    reset: function() {
        delete this.flights;
        delete this.options;
        delete this.vehicles;

        this.flights = { active: [], upcoming: [] };
        this.options = {};
        this.vehicles = [];
    },

    init: function(options) {
        // options
        options = options || {};
        options.filter = options.filter || null;    // filter to only specific callsigns
        options.poll = options.poll || true;        // poll: true conitnue to poll for new telemtry, false for archive viewing
        this.options = options;

        // pull flight list
        this.update_flight_list();
    },
    update_flight_list: function() {
        this.db.get_flights(function(data) {
            var current_ts = habitat.util.timestamp_now();

            for(k in data) {
                var flight_ts = habitat.util.rfc3339_to_timestamp(data[k].start);

                if(flight_ts < current_ts) habitat.tracker.flights.active.push(data[k]);
                else habitat.tracker.flights.upcoming.push(data[k]);
            }
        });
    },

    test: function() {
        var out = $('body');

        out.append("Upcoming flights<br><br>");
        this.append(this.flights.upcoming);
        out.append("<br>Active flights<br><br>");
        this.append(this.flights.active);
    },

    append: function(ref) {
        var out = $('body');

        for(k in ref) { out.append(ref[k].start + " " + ref[k].name + "<br />"); }
    }
}
