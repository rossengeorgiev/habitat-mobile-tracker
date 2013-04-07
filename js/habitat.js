// This file is part of Habitat Mobile Tracker

// root object
var habitat = {
    // initialize
    db: $.couch.db("habitat")
};

// temporary fix for CORS
habitat.db.uri = "http://habitat.habhub.org/habitat/";
