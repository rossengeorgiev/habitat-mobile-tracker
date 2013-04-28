# order of map elements
Z_RANGE = 1
Z_STATION = 2
Z_PATH = 10
Z_CAR = 11
Z_SHADOW = 12
Z_PAYLOAD = 13

# ballons modes
MODE_BALLOON = 1
MODE_CHUTE = 2
MODE_LANDED = 3

class habitat.tracker.Vehicle
# default options
    marker: null
    markers_root: "img/markers/"
    map: null
    name: "undefined"
    type: "car"
    color: "blue"
    position: null
    altitude: 0

    constructor: (opts) ->
        if opts?
            if opts.position? then @position = opts.position
            if opts.altitude? then @altitude = opts.altitude
            if opts.map? then @map = opts.map

            if opts.color? then @color = opts.color
            if opts.type? then @type = opts.type
            if opts.name? then @name = opts.name

         @init()


    @init: ->
        @marker = new google.maps.Marker
            map: @map
            optimized: false
            zIndex: Z_PAYLOAD
            icon:
                url: "#{@markers_root}#{@type}-#{@color}.png"
                size: new google.maps.Size(55,25),
                scaledSize: new google.maps.Size(55,25)
            title: @name
        null

    setPosition: (lat,lng) ->
        @position = new google.maps.LatLng latlng[0], latlng[1]
        @marker.setPosition @position

    setAltitude: (alt) ->
        @altitude = alt

class habitat.tracker.Balloon extends habitat.tracker.Vehicle
    marker_shadow: null
    type: "balloon"
    mode: -1
    path: null
    polyline: null
    timestamp: 0

    init: ->
        @path = []
        # init markers, we need two
        @marker = new google.maps.Marker
            map: @map
            optimized: false
            zIndex: Z_PAYLOAD
            title: @name
        @marker_shadow = new google.maps.Marker
            map: @map
            icon:
                url: "#{@markers_root}shadow.png"
                size: new google.maps.Size 24,16
                scaledSize: new google.maps.Size 24,16
                anchor: new google.maps.Point 12,8
            optimized: false
            zIndex: Z_SHADOW

        @setMode MODE_BALLOON

        # draws the path
        @polyline = new google.maps.Polyline
            map: @map
            zIndex: Z_PATH,
            strokeColor: @color
            strokeOpacity: 0.8,
            strokeWeight: 3,
            clickable: false,
            draggable: false,

        # update altitude offset, when map zoom is changed
        this_ref = this
        google.maps.event.addListener @map,'idle', ->
            this_ref.update_position()

    setTelemetry: (tele) ->
        @telemetry = tele
        null

    setPosition: (lat,lng) ->
        @position = new google.maps.LatLng lat,lng

    addPosition: (lat,lng) ->
        @setPosition lat,lng
        @path.push @position
        null

    setAltitude: (alt) ->
        @altitude = alt

    # change marker icon to balloon, parachute or just payload
    setMode: (mode) ->
        if @mode is mode then return
        @mode = mode

        switch mode
            when MODE_BALLOON, MODE_CHUTE
                @marker_shadow.setVisible true
                icon =
                    url: "#{@markers_root}#{if MODE_BALLOON then 'balloon' else 'parachute'}-#{@color}.png"
                    size: new google.maps.Size(46,84),
                    scaledSize: new google.maps.Size(46,84)
            when MODE_LANDED
                @marker_shadow.setVisible false
                icon =
                    url: "#{@markers_root}payload-#{@color}.png"
                    size: new google.maps.Size(17,18),
                    scaledSize: new google.maps.Size(17,18)

        @marker.setIcon icon
        null

    # emulate altitude on the map by move the marker slighly north
    altitude_offset: ->
        if not @map or not @position or @mode is "landed" then return

        pixel_altitude = 0
        zoom = @map.getZoom()
        zoom = if zoom > 18 then 18 else zoom

        if 0 < @altitude < 55000
            pixel_altitude = -Math.round @altitude/(1000/3)*(zoom/18.0)
            habitat.tracker.map_pixel_offset @position, [0, pixel_altitude]
        else
            @position

    update_position: ->
        @marker.setPosition @altitude_offset()
        @marker_shadow.setPosition @position

    # call this to push the latest changes to the map
    redraw: ->
        # redraw markers
        @update_position()

        # redraw path
        @polyline.setPath @path
