var TRACKS, RIDES_COUNT, TOTAL;

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
        center: [52.096368567021884, 23.731304143846582],
        zoom: 13,
        type: 'yandex#satellite',
        behaviors: ['default', 'scrollZoom']
    });

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

    function calcToMinskStr(km) {
        var distance = 350;
        return (Math.round((km / distance) * 100) / 100).toString();
    }
    function calcWorldTripStr(km) {
        var distance = 40075;
        return (Math.round((km / distance) * 10000) / 10000).toString();
    }
}

// uses globals
function processTracks() {
    RIDES_COUNT = TRACKS.length;
    TOTAL = 0;

    TRACKS.forEach(function(track) {
        var distance = 0;

        track.path.reduce(function(prev, current) {
            distance += ymaps.coordSystem.geo.getDistance(prev, current);
            return current;
        });

        track.distance = distance / 1000;
        TOTAL += distance;
    });

    // bacause meters
    TOTAL = Math.floor(TOTAL / 100) / 10;
}
