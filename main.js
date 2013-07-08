var TRACKS, RIDES_COUNT, TOTAL, MIN_DISTANCE, AVG_DISTANCE, MAX_DISTANCE, LONGEST_TRACK;
var LONGEST_TIMEOUT;
var MAP;
var OPENED_BALLOON = null;

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
    updatePathList();
    handleTabs();
    drawHeatmap();
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

    var projection = rideMap.options.get('projection');

    TRACKS.forEach(function(track) {
        var normalColor = '#ff0000',
            hoverColor = '#ffff00',
            notLongestColor = normalColor,
            longestColor = '#00ff00';

        var normalZindex = 1,
            hoverZindex = 42;

        if (track === LONGEST_TRACK) {
            normalZindex = 12;
            normalColor = longestColor;
        }

        var distance = Math.floor(track.distance * 10) / 10;

        // from 0.3 to 0.8. Secret formula.
        var opacity = 0.3 + ((track.distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) * (0.8 - 0.3);

        var polyline = new ymaps.Polyline(track.path, {
            hintContent: distance + 'км',
            balloonContentHeader: track.name,
            balloonContent: 'Длина: ' + distance + 'км',
            balloonContentFooter: track.date
        }, {
            strokeColor: normalColor,
            strokeWidth: 4,
            strokeOpacity: opacity,
            zIndex: normalZindex,
            zIndexHover: hoverZindex
        });

        track.mapApi = {
            hover: function(to, fromMap) {
                polyline.options.set('strokeColor', to ? hoverColor : normalColor);
                polyline.options.set('strokeOpacity', to ? 0.9 : opacity);
                polyline.options.set('zIndex', to ? hoverZindex : normalZindex);

                if (OPENED_BALLOON !== null) {
                    OPENED_BALLOON.mapApi.balloon(false);
                }

                if (track !== LONGEST_TRACK) {
                    if (to || fromMap) {
                        clearTimeout(LONGEST_TIMEOUT);
                        LONGEST_TRACK.mapApi.notLongest(to);
                    } else {
                        LONGEST_TIMEOUT = setTimeout(function() {
                            LONGEST_TRACK.mapApi.notLongest(to);
                        }, 250);
                    }
                } else {
                    clearTimeout(LONGEST_TIMEOUT);
                }
            },
            notLongest: function(to) {
                polyline.options.set('strokeColor', to ? notLongestColor : longestColor);
            },
            balloon: function(to) {
                if (to) {
                    OPENED_BALLOON = track;
                    polyline.balloon.open();
                } else {
                    OPENED_BALLOON = null;
                    polyline.balloon.close();
                }
            },
            getPixelBounds: function(zoom) {
                zoom = 13;

                var bounds = polyline.geometry.getBounds();
                return [projection.toGlobalPixels(bounds[0], zoom),
                        projection.toGlobalPixels(bounds[1], zoom)];
            }
        };

        polyline.events.add('mouseenter', function() {
            track.mapApi.hover(true, true);
        });
        polyline.events.add('mouseleave', function() {
            track.mapApi.hover(false, true);
        });

        rideMap.geoObjects.add(polyline);
    });
}

// uses globals
function drawHeatmap() {
    var bounds = TRACKS.slice(1).reduce(function(acc, track) {
        var bounds = track.mapApi.getPixelBounds();

        return [
            [Math.min(acc[0][0], bounds[0][0]), Math.max(acc[0][1], bounds[0][1])],
            [Math.max(acc[1][0], bounds[1][0]), Math.min(acc[1][1], bounds[1][1])]
        ];
    }, TRACKS[0].mapApi.getPixelBounds());

    var p = MAP.options.get('projection');
    var geoBounds = [p.fromGlobalPixels(bounds[0], 13), p.fromGlobalPixels(bounds[1], 13)];

    var width = Math.floor(bounds[1][0] - bounds[0][0]),
        height = Math.floor(bounds[0][1] - bounds[1][1]);

    var leftCorner = bounds[0][0],
        topCorner = bounds[1][1];

    $('#heatmap').attr('width', width).attr('height', height);

    var heatmap = createWebGLHeatmap({
        canvas: $('#heatmap').get(0)
    });

    var every = 100; // meters

    TRACKS.forEach(function(track) {
        var pointsCount = Math.floor(1000 * track.distance / every);
        var offset = ((1000 * track.distance) - (pointsCount - 1) * every) / 2;

        //var direction = ymaps.coordSystem.geo.solveInverseProblem(previos, current).startDirection;
        //ymaps.coordSystem.geo.solveDirectProblem(previos, direction, every);
        //var firstPosition = moveFromTo(track.path[0], track.path[1], offset);

        track.path.slice(1).reduce(function(previos, current) {
            var distance = ymaps.coordSystem.geo.getDistance(previos, current);

            if (distance >= every) {
                previos = moveFromTo(previos, current, offset);

                while ((distance = ymaps.coordSystem.geo.getDistance(previos, current)) >= every) {
                    placePoint(previos);

                    previos = moveFromTo(previos, current, every);
                }

                offset = every - distance;
            } else {
                if (offset > distance) {
                    offset -= distance;
                } else {
                    placePoint(moveFromTo(previos, current, distance - offset));
                    offset = every - (distance - offset);
                }
            }

            return current;
            /*var point = moveFromTo(previos, current, every);

            var pos = p.toGlobalPixels(point, 13);
            pos[0] -= leftCorner;
            pos[1] -= topCorner;

            console.log(pos);

            heatmap.addPoint(pos[0], pos[1], 10, 1);

            // FIXME Вообще говоря, это неправильно и будут скашиваться пути
            return current;*/
        });

        function placePoint(point) {
            var pos = p.toGlobalPixels(point, 13);
            pos[0] -= leftCorner;
            pos[1] -= topCorner;

            heatmap.addPoint(pos[0], pos[1], 35, 0.09);
        }

        function moveFromTo(from, to, distance) {
            var direction = ymaps.coordSystem.geo.solveInverseProblem(from, to).startDirection;
            return ymaps.coordSystem.geo.solveDirectProblem(from, direction, distance).endPoint;
        }
        //track.path
        /*track.path.forEach(function(point) {
            var pos = p.toGlobalPixels(point, 13);
            pos[0] -= leftCorner;
            pos[1] -= topCorner;

            heatmap.addPoint(pos[0], pos[1], 35, 0.15);
        });*/
    });

    heatmap.update();
    heatmap.display();
    //console.log(width, height);
    //MAP.setCenter(geoBounds[1]);
    //console.log(geoBounds);
    /*var c1 = new ymaps.Circle([geoBounds[0], 10], {
            strokeColor: '#000000',
            strokeWidth: 5});
    var c2 = new ymaps.Circle([geoBounds[1], 10]);*/

    //console.log(TRACKS[0].mapApi.getPixelBounds());
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
}

// uses globals
function updatePathList() {
    var ul = $('#pathList');
    
    TRACKS.forEach(function(track) {
        var text = track.name + ' (' + track.date + ')';

        var span = $('<span>').addClass('border-here').text(text);
        var kmBadge = $('<span>').addClass('label').text(trunc(track.distance, 1) + 'км');

        var grade = Math.floor(((track.distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) * 5);
        if (grade === 5) grade = 4;
        if (grade > 0) {
            kmBadge.addClass(['info', 'success', 'warning', 'important'
            ].map(function(g) { return 'label-' + g; })[grade - 1]);
        }

        ul.append($('<li>').append(span).append($('<span>').text(' ')).append(kmBadge));

        span.on('mouseenter', function() {
            track.mapApi.hover(true);
        }).on('mouseleave', function() {
            track.mapApi.hover(false);
        }).on('click', function() {
            track.mapApi.balloon(true);
        });
    });
}

function handleTabs() {
    var statsButton = $('#statsButton'),
        pathButton = $('#pathButton'),
        statsBlock = $('#statsBlock'),
        pathBlock = $('#pathBlock');

    statsButton.click(function() {
        statsButton.prop('disabled', true);
        pathButton.prop('disabled', false);
        $('#pathBlock').hide();
        $('#statsBlock').show();
    });
    pathButton.click(function() {
        pathButton.prop('disabled', true);
        statsButton.prop('disabled', false);
        $('#statsBlock').hide();
        $('#pathBlock').show();
    });
}

// uses globals
function processTracks() {
    RIDES_COUNT = TRACKS.length;
    TOTAL = 0;
    MIN_DISTANCE = Infinity;
    MAX_DISTANCE = -Infinity;

    TRACKS = TRACKS.sort(function(a, b) {
        if (a.date !== b.date) {
            return a.date < b.date ? -1 : 1;
        } else {
            return a.number < b.number ? -1 : 1;
        }
    });

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
            LONGEST_TRACK = track;
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

function trunc(number, to) {
    var t = Math.pow(10, to);
    return Math.round(number * t) / t;
}
