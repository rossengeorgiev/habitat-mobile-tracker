habitat.tracker =
    flights:
        active: []
        upcoming: []
    options: {}
    vehicles: []

    ### reset tracker state to pre-init state ###
    reset: ->
        delete this.flights
        delete this.options
        delete this.vehicles

        this.flights =
            active: []
            upcoming: []
        this.options = {}
        this.vehicles = []

    init: (options) ->
        options = if options then options else {}
        options.filter = if options.filter then open|| null
        options.poll = options.poll || true
        this.options = options

        """ pull flight list """
        this.update_flight_list()

    update_flight_list: ->
        this.db.get_flights (data) ->
            current_ts = habitat.util.timestamp_now()

            for flight in data
                flight_ts = habitat.util.rfc3339_to_timestamp flight.start

                if flight_ts < current_ts
                    habitat.tracker.flights.active.push flight
                else
                    habitat.tracker.flights.upcoming.push flight

            null

    test: ->
        out = $('body')

        out.append("Upcoming flights<br><br>")
        this.append(this.flights.upcoming)
        out.append("<br>Active flights<br><br>")
        this.append(this.flights.active)

    append: (list) ->
        out = $('body')

        for flight in list
            out.append "#{flight.start} #{flight.name} <br />"
