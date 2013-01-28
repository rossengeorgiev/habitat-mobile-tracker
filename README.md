# Habitat Mobile Tracker

A tracker web-app specifically crafted for use on mobile devices.
Also, works great on desktops, laptops or netbooks. It is build upon
[spacenear.us/tracker](http://spacenear.us/tracker) and habitat.

[Live version](http://habhub.org/mt/)

## Features

* HAB tracking with Habitat
* Map tracker with Google Maps API 3
* Chase Car functionality
* Daylight cycle overlay, for long flights

### Geo position

The app will ask for permission to use your location.
This is required for some of the features. It is **important** to note that
your location will not be made available or send to anyone. Unless you enable
 the `chase car mode`, which will periodically upload it to habitat. _The app
will always start with `chase car mode` disabled._

### Offline storage

The app will ask to use offline storage. You will need to accept in order to
use the offline capabilities. The app will cache all files making it available
even when there is no network coverage. Latest position data will also be stored
and used when you start up with no network. When you get back online, the app
will fetch the latest position data.

## Design

Author: Daniel Saul [@danielsaul](https://github.com/danielsaul)

[See concept for phone portrait mode](https://github.com/rossengeorgiev/habitat-mobile-tracker/blob/master/resources/concept-app-portrait.png)  
[See concept for tablets](https://github.com/rossengeorgiev/habitat-mobile-tracker/blob/master/resources/concept-app-tablet.png)


## Currently Supported Devices

### iOS, Android, Deskstops

* Modern browser required (IE not supported)
* Browsers supporting _Geolocation API_ will have `Chase car mode` available
* For best experience on _iOS devices_, add the webapp to your home screen.
This will hide Safari's UI and make it look like a native app. I think it also allows it to run in the background.


## iPhone demo page

Portrait and landscape test. Just open `test-iphone3g.html` in your browser of choice

