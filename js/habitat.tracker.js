habitat.tracker = {
    flights: { active: [], upcoming: [] },


    init: function() {

        // pull flight list
        this.db.get_flights(function(data) {
            var ts = Math.floor(new Date().getTime() / 1000);

            for(k in data) {
                if(data[k].key[1] < ts) habitat.tracker.flights.active.push(data[k]);
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

        for(k in ref) { out.append(new Date(ref[k].doc.start).toUTCString() + " " + ref[k].doc.name + "<br />"); }
    }
}
