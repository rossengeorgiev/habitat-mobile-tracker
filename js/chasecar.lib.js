/* Habitat ChaseCar lib
 * Uploads geolocation for chase cars to habitat
 *
 * Author: Rossen Gerogiev
 * Requires: jQuery
 */

ChaseCar = {
    db_uri: "http://habitat.habhub.org/",   // db address
    uuidsRequested: false,                  // used in .request() to track whenever it has requested uuids
    _uuids: [],                           // array with uuids
    ucount: 20,                             // number of uuids in the _uuids array (determines how many uuids are request at a time)
    uused: 0,                              // how many have been used for requests
    queue: []                               // request queue, incase we dont have uuids
};
ChaseCar.uused = ChaseCar.ucount; // we start without any uuids

// get some uuids for us to use
ChaseCar.getUUIDS = function(callback) {
    $.getJSON(ChaseCar.db_uri + "_uuids?count=" + ChaseCar.ucount, function (data) {
        ChaseCar._uuids = data.uuids;  // load the new uuids
        ChaseCar.uused = 0;            // reset counter
        if(callback) callback();
    });
};
// handles request and uuid management
// @doc JSONobject
ChaseCar.request = function(doc) {
    if(doc) { ChaseCar.queue.push(doc); }

    var i = ChaseCar.queue.length;
    while(i--) {
        if(ChaseCar.ucount == ChaseCar.uused && !ChaseCar.uuidsRequested) {
            ChaseCar.uuidsRequested = true; // blocks further uuids request until the current one completes
            ChaseCar.getUUIDS(function() {
                    ChaseCar.uuidsRequested = false;
                    ChaseCar.request();
                });
            return;
        } else {
            ChaseCar.uused++;
            // get one uuid and one doc from the queue and push to habitat
            var uuid = ChaseCar._uuids.shift();
            doc = ChaseCar.queue.shift();

            // update doc with uuids and time of upload
            doc._id = uuid;
            doc.time_uploaded = (new Date()).toISOString();

            // push the doc to habitat
            $.ajax({
                   type: "POST",
                   url: ChaseCar.db_uri + "habitat/",
                   contentType: "application/json; charset=utf-8",
                   dataType: "json",
                   data: JSON.stringify(doc),
            });
        }
    }
};
// run once at start,
// @callsign string
ChaseCar.putListenerInfo = function(callsign) {
    if(!callsign) return;

    ChaseCar.request({
            'type': "listener_information",
            'time_created': (new Date()).toISOString(),
            'data': { 'callsign': callsign }
        });
};
// run every time the location has changed
// @callsign string
// @position object (geolocation position object)
ChaseCar.updatePosition = function(callsign, position) {
    if(!position || !position.coords) return;

    ChaseCar.request({
            'type': "listener_telemetry",
            'time_created': (new Date()).toISOString(),
            'data': {
                'callsign': callsign,
                'chase': true,
                'latitude': position.coords.latitude,
                'longitude': position.coords.longitude,
                'altitude': ((!!position.coords.altitude) ? position.coords.altitude : 0),
                'speed': ((!!position.coords.speed) ? position.coords.speed : 0),
                'client': {
                    'name': 'Habitat Mobile Tracker',
                    'version': '{VER}',
                    'agent': navigator.userAgent
                }
            }
        });
};
