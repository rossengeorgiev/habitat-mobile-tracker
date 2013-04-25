$ = $ || {}

habitat =
    db: if $.couch then $.couch.db "habitat" else {}

habitat.db.uri = "http://habitat.habhub.org/habitat/"
