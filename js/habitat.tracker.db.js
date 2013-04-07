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
                        list.push(data.rows[k]);
                    } else if(payloads.indexOf(doc._id) != -1) {
                        last.payloads.push(doc);
                    }
                }

                // return results
                callback(list);
            },
        });
    }
};
