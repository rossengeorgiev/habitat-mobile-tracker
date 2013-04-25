
habitat.util =
    timestamp_now: ->
        Math.floor (new Date()).getTime() / 1000

    rfc3339_to_timestamp: (str) ->
         Math.floor (new Date str).getTime() / 1000

    timestamp_to_rfc3339: (ts) ->
        date = new Date()
        date.setTime ts * 1000
        date.toISOString()
