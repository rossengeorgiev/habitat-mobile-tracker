habitat.tracker.db = {

    // pulls latest flights from habitat
    get_flights: function(callback, selector) {
        var ts = Math.floor(new Date().getTime() / 1000);

        habitat.db.view("flight/end_start_including_payloads", {
            startkey: [ts],
            include_docs: true,
            success: function(data) {
                var last = null, list = [], payloads;

                // merge payload_configs into flight docs
                for(k in data.rows) {
                    var doc = data.rows[k].doc;

                    if(doc.type == "flight" && doc.approved == true) {
                        last = doc;
                        payloads = doc.payloads;
                        doc.payloads = [];
                        list.push(doc);
                    } else if(payloads.indexOf(doc._id) != -1) {
                        last.payloads.push(doc);
                    }
                }

                // return results
                callback(list);
            },
        });
    },
    get_telemetry: function(payload_ids) {
        var keys = [];
        for(k in payload_ids) { keys.push({ 'key': payload_ids[k] }); }

    },
    fetch_payloads: function(flight_docs) {
        var list = [];

        for(k in flight_docs) {
           list.concat(flight_docs[k].payloads);
        }

        return list;
    }
};
