habitat.tracker.db =

    # pulls latest flights from habitat
    get_flights: (callback, time) ->
        ts = if time? then time else Math.floor (new Date()).getTime() / 1000

        habitat.db.view "flight/end_start_including_payloads",
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

    get_telemetry_by_flight_id: (callback, id) ->
        habitat.db.view "payload_telemetry/flight_payload_time",
            startkey: [id]
            endkey: [id,{}]
            include_docs: true
            success: (data) -> callback data.rows

    get_telemetry_by_id: (callback, id, time = 0) ->
        habitat.db.view "payload_telemetry/payload_time",
            startkey: [id,time]
            endkey: [id,{}]
            include_docs: true
            success: (data) -> callback data.rows
