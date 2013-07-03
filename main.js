var TRACKS, RIDES_COUNT, TOTAL, MIN_DISTANCE, AVG_DISTANCE, MAX_DISTANCE;
var MAP;

var loadLeft = 0;
function isOneLoaded() { loadLeft--; if (loadLeft === 0) start(); }

loadLeft++; // maps
ymaps.ready(isOneLoaded);
loadLeft++; // DOM
$(isOneLoaded);
loadLeft++; // ajax load of tracks
$.get('tracks.json', {}, function(data) {
    TRACKS = data;
    isOneLoaded();
}, 'json');

function start() {
    processTracks();
    
    updateStats();
    drawMap();
}

// uses globals
function drawMap() {
    // Создаем карту.
    var rideMap = new ymaps.Map('map', {
        center: [52.090942428567935, 23.728316440837304],
        zoom: 13,
        type: 'yandex#satellite',
        behaviors: ['default', 'scrollZoom']
    });

    MAP = rideMap; // hack for .getCenter() from browser console :|

    rideMap.controls.add('zoomControl', {left: 5, top: 5});
    rideMap.controls.add('typeSelector');

    TRACKS.forEach(function(track) {
        var normalColor = '#ff0000',
            hoverColor = '#ffff00';

        var distance = Math.floor(track.distance * 10) / 10;

        var polyline = new ymaps.Polyline(track.path, {
            hintContent: distance + 'км',
            balloonContentHeader: track.name,
            balloonContent: 'Длина: ' + distance + 'км',
            balloonContentFooter: track.date
        }, {
            strokeColor: normalColor,
            strokeWidth: 4,
            strokeOpacity: 0.6,
            zIndex: 1,
            zIndexHover: 42
        });

        polyline.events.add('mouseenter', function() {
            polyline.options.set('strokeColor', hoverColor);
        });
        polyline.events.add('mouseleave', function() {
            polyline.options.set('strokeColor', normalColor);
        });

        rideMap.geoObjects.add(polyline);
    });
}

// uses globals
function updateStats() {
    $('#totalRides').text(RIDES_COUNT);
    $('#totalKm').text(TOTAL + 'км');
    $('#toMinsk').text(calcToMinskStr(TOTAL));
    $('#worldTrip').text(calcWorldTripStr(TOTAL) + '%');

    $('#minRide').text(trunc(MIN_DISTANCE, 1) + 'км');
    $('#avgRide').text(trunc(AVG_DISTANCE, 1) + 'км');
    $('#maxRide').text(trunc(MAX_DISTANCE, 1) + 'км');

    function calcToMinskStr(km) {
        var distance = 350;
        return (Math.round((km / distance) * 100) / 100).toString();
    }
    function calcWorldTripStr(km) {
        var distance = 40075;
        return (Math.round((km / distance) * 10000) / 10000).toString();
    }

    function trunc(number, to) {
        var t = Math.pow(10, to);
        return Math.round(number * t) / t;
    }
}

// uses globals
function processTracks() {
    RIDES_COUNT = TRACKS.length;
    TOTAL = 0;
    MIN_DISTANCE = Infinity;
    MAX_DISTANCE = -Infinity;

    TRACKS.forEach(function(track) {
        var distance = 0;

        track.path.reduce(function(prev, current) {
            distance += ymaps.coordSystem.geo.getDistance(prev, current);
            return current;
        });

        if (distance < MIN_DISTANCE) {
            MIN_DISTANCE = distance;
        }
        if (distance > MAX_DISTANCE) {
            MAX_DISTANCE = distance;
        }

        track.distance = distance / 1000;
        TOTAL += distance;
    });

    MIN_DISTANCE /= 1000;
    MAX_DISTANCE /= 1000;
    // bacause meters
    TOTAL = Math.floor(TOTAL / 100) / 10;

    AVG_DISTANCE = TOTAL / RIDES_COUNT;
}
