habitat.tracker =
# configs
    color_names: ["red", "blue", "green", "yellow", "purple", "orange", "cyan"]
    colors: ["#f00", "blue", "green", "#ff0", "#c700e6", "#ff8a0f", "#0fffca"]

# reserved
    db: null
    Vehicle: null
    Balloon: null

# properties
    color_idx: 0
    flights:
        active: []
        upcoming: []
    options: {}
    vehicles: {}
    map: null

# methods
    init: (opts) ->
        if @map then return

        if opts?
            @options = opts

        @map = new google.maps.Map document.getElementById('map'),
            zoom: 5
            center: new google.maps.LatLng  53.467511,-2.2338940
            mapTypeId: google.maps.MapTypeId.ROADMAP
            keyboardShortcuts: false
            streetViewControl: false
            rotateControl: false
            panControl: false
            scaleControl: false
            zoomContro: true
            zoomControlOptions:
                style: google.maps.ZoomControlStyle.LARGE
            scrollwheel: true

        @map._overlay = new google.maps.OverlayView()
        @map._overlay.draw = ->
        @map._overlay.setMap @map

        # pull flight list
        @update_flight_list()

        # wait for the map to load
        google.maps.event.addListenerOnce @map,'tilesloaded', ->
            habitat.tracker.mapLoaded()
        null

    mapLoaded: ->
        tmp = window.location.search.split('=')
        if tmp[0] is "?ids"
            list = tmp[1].split(',')

            for id in list
                @db.get_telemetry_by_id(@consumer, id)
        else
            @fetch_test()

        null

    # reset tracker state to pre-init state
    reset: ->
        delete @flights
        delete @options
        delete @vehicles

        @flights =
            active: []
            upcoming: []
        @options = {}
        @vehicles = []

    # gets the latest flight from habitat
    update_flight_list: ->
        @db.get_flights (data) ->
            current_ts = habitat.util.timestamp_now()

            for flight in data
                flight_ts = habitat.util.rfc3339_to_timestamp flight.start

                if flight_ts < current_ts
                    habitat.tracker.flights.active.push flight
                else
                    habitat.tracker.flights.upcoming.push flight

            null

    fetch_latest_telemetry: ->
        for flight in  @flights.active
            for payload in flight.payloads
                @db.get_telemetry_by_id @consumer payload._id
        null

    # chews through any data from habitat
    consumer: (habitat_result) ->
        if habitat_result.length == 0 then return

        for row in habitat_result
            switch row.doc.type
                when "payload_telemetry" then habitat.tracker.process_telemetry row
                when "listener_telemetry" then habitat.tracker.process_listener row
                else continue

        habitat.tracker.refresh()
        null

    refresh: ->
        for key of @vehicles
            @vehicles[key].redraw()
        null

    process_telemetry: (row) ->
        doc = row['doc']
        key = row['key']
        ts = key[-1..][0]

        if not @vehicles[doc.data._parsed.payload_configuration]?
            @vehicles[doc.data._parsed.payload_configuration] = new habitat.tracker.Balloon
                map: @map
                name: doc.data.payload
                color: @color_names[@color_idx++ % @color_names.length]

        veh = @vehicles[doc.data._parsed.payload_configuration]

        # if initial packet has 0,0 lat/long, drop it
        if veh.path.length is 0 and doc.data.latitude is 0 and doc.data.longitude is 0 then return

        # if packet is out of order, drop it
        if ts <= veh.timestamp then return
        veh.timestamp = ts

        veh.setAltitude doc.data.altitude
        veh.addPosition doc.data.latitude, doc.data.longitude

        telemetry = {}

        for key,val of doc.data
            if key[0] is '_' then continue

            switch key
                when "altitude","payload","latitude","longitude","time"
                    continue
                else
                    telemetry[key] = val

        veh.setTelemetry telemetry
        null

    process_listener: (row) ->
        null

# tempolary methods
    fetch_test: ->
        @db.get_telemetry_by_id(@consumer, "b177187f988c44cce53eca6106381564")

    clear: ->
        $('body').html ''

    list: ->
        out = $('body')
        @clear

        out.append("Upcoming flights<br><br>")
        @append(@flights.upcoming)
        out.append("<br>Active flights<br><br>")
        @append(@flights.active)

    append: (list) ->
        out = $('body')

        for flight in list
            out.append "#{flight.start} #{flight.name} [<i>#{flight._id}</i>]<br />"
            for payload, k in flight.payloads
                out.append if  k == _len1-1 then "\\- " else "|-"
                out.append "#{payload.name} [<i>#{payload._id}</i>]<br />"

        null

    map_pixel_offset: (pos, offset) ->
        new_pos = @map._overlay.getProjection().fromLatLngToDivPixel pos
        new_pos.x += offset[0]
        new_pos.y += offset[1]
        @map._overlay.getProjection().fromDivPixelToLatLng new_pos
