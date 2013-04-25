habitat.tracker.db =

    # pulls latest flights from habitat
    get_flights: (callback, selector) ->
        ts = Math.floor (new Date()).getTime() / 1000

        habitat.db.view "flight/end_start_including_payloads", {
            startkey: [ts]
            include_docs: true
            success: (data) ->
                last = null
                list = []
                payloads

                # merge payload_configs into flight docs
                for row in data.rows
                    doc = row.doc

                    if doc.type is "flight" and doc.approved is true
                        last = doc
                        payloads = doc.payloads
                        doc.payloads = []
                        list.push doc
                    else if payloads.indexOf doc._id is not -1
                        last.payloads.push doc

                # return results
                callback list
                null
            }

    fetch_payloads: (flight_docs) ->
        list = []

        for doc in flight_docs
           list.concat(doc.payloads);

        null
