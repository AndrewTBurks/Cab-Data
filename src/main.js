var objects = [];

var selectionBG = null;
var selectionBounds = null;

var censusTracts = null;

var mode = "query"; // or "time"
var queryMode = "queryOrig";

var areaSelect = L.areaSelect({width:200, height:200, keepAspectRatio:false});
var selectorMode = "visible";

var map;

var tractColorScale = d3.scaleLinear()
  .domain([0,1])
  .range(["#fee0b6", "#f1a340", "#b35806"]);

var binColorScale = d3.scaleLinear() 
  .domain([0,1])
  .range(["#998ec3", "#542788"]);

var changeColorScale = d3.scaleLinear()
  .domain([-10, 0, 10])
  .range(["#542788", "#f7f7f7", "#b35806"]);

var query = {
  base: "https://data.cityofchicago.org/resource/wrvz-psew.json/?",
  limit: "$limit=100000", // 100,000
  query: "$select=pickup_centroid_location, dropoff_centroid_location, pickup_census_tract, dropoff_census_tract",
  time: "$where=trip_start_timestamp between '2015-01-01T12:00:00' and '2016-02-01T14:00:00'",
  group: "$group=dropoff_census_tract",
  make: function(bounds) {
    var within;

    var withinVar = "";
    var notWithinVar = "";

    if (queryMode === "queryOrig") {
      withinVar = "pickup_centroid_location";
      notWithinVar = "dropoff_centroid_location";
    } else {
      withinVar = "dropoff_centroid_location";
      notWithinVar = "pickup_centroid_location";
    }

    if (bounds) {
      within = "$where=within_box(" + withinVar + ", " + 
        bounds._northEast.lat + ", " + bounds._southWest.lng + ", " +
        bounds._southWest.lat + ", " + bounds._northEast.lng + ")" + " AND " +
        "NOT within_box(" + notWithinVar + ", " + 
        bounds._northEast.lat + ", " + bounds._southWest.lng + ", " +
        bounds._southWest.lat + ", " + bounds._northEast.lng + ")" + " AND " +
        "trip_start_timestamp between '2015-01-01T12:00:00' and '2016-02-01T14:00:00'";
    } else {
      within = "$where=trip_start_timestamp between '2015-01-01T12:00:00' and '2016-02-01T14:00:00'";
    }

    return this.base + [this.query,this.limit,within].join("&");
  }
}

var time = {
  base: "https://data.cityofchicago.org/resource/wrvz-psew.json/?",
  limit: "$limit=100000", // 100,000
  query: "$select=pickup_centroid_location, dropoff_centroid_location, pickup_census_tract, dropoff_census_tract, trip_start_timestamp, trip_end_timestamp",
  group: "$group=trip_start_timestamp",
  make: function(start = "2015-01-01T12:00:00", end = "2015-01-03T12:00:00") {

    var within = "$where=trip_start_timestamp between '" + start + "' and '" + end + "'" + " OR " + 
      "trip_end_timestamp between '" + start + "' and '" + end + "'"

    return this.base + [this.query,this.limit,within].join("&");
  },
  aggregated: null
}

function init() {

  map = L.map('map', {
    center: [41.8781, -87.6298],
    zoom: 10.5
  });

  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.streets',
    accessToken: 'pk.eyJ1IjoiYW5kcmV3dGJ1cmtzIiwiYSI6ImNpdnNmcHQ0ejA0azYydHBrc3drYWRwcTgifQ.pCA_a_l6sPcMo8oGzg5stQ',
  })
  .addTo(map);

  areaSelect.on("change", function() {
    d3.selectAll(".currSelection").remove();
    var bounds = selectionBounds = this.getBounds();

    if (mode === "query") {
      selectionBG = L.rectangle(bounds, {color: "#de2d26", weight: 1, fillOpacity: 0, className: "currSelection"}).addTo(map);
    }
  });

  areaSelect.addTo(map);

  d3.json("./tracts.geojson", (err, data) => {
    function whenClicked(e) {
      // draw graph of data over time
      if (mode === "time" && time.aggregated) {
        console.log(time.aggregated[e.target.feature.properties.geoid10]);
      }
    }

    function whenHovered (e) {
      d3.select(".tract" + e.target.feature.properties.geoid10)
        .style("stroke", "red")
        .style("stroke-width", 3);

      d3.select("#tip")
        .style("display", "initial")
        .style("left", e.containerPoint.x + 15 + "px")
        .style("top", e.containerPoint.y - 45 + "px")
        .node().innerHTML = "Tract:<br>" + e.target.feature.properties.geoid10;
    }
    

    function onEachFeature(feature, layer) {
        //bind click
        layer.on({
            click: whenClicked,
            mouseover: whenHovered,
            mouseout: function(e) {
              d3.select(".tract" + e.target.feature.properties.geoid10)
                .style("stroke", function(d) {
                  if (d3.select(this).classed("isVisible")) {
                    return "black";
                  }
                  return "none";
                })
                .style("stroke-width", 1);

              d3.select("#tip")
                .style("display", "none");
            }
        });
    }

    censusTracts = L.geoJSON(data, {
      style: function (feature) {
        return {
          color: "black",
          weight: 1,
          strokeOpacity: 0.5,
          fillColor: "#fbb4ae",
          fillOpacity: 0.5,
          className: ("censusTract tract" + feature.properties.geoid10)
        };
      },
      onEachFeature: onEachFeature
    })
    .addTo(map);

    dataRequest(query.make(), useData);
  });

  
}

function queryArea(mode) {
  queryMode = mode.name;

  var withinVar = "";
  var notWithinVar = "";

  if (queryMode === "queryOrig") {
    withinVar = "pickup_centroid_location";
    notWithinVar = "dropoff_centroid_location";
  } else {
    withinVar = "dropoff_centroid_location";
    notWithinVar = "pickup_centroid_location";
  }

  d3.selectAll(".currSelection").remove();
  d3.selectAll(".bin").remove();

  dataRequest(query.make(selectionBounds), useData);

  selectionBG = L.rectangle(selectionBounds, {color: "#de2d26", weight: 1, className: "currSelection"}).addTo(map);
}

function toggleMode() {
  if (mode === "query") {
    mode = "time";

    // areaSelect.remove();
    // areaSelect.on("change", function() { });

    d3.select("#modeTitle").node()
      .innerHTML = "Time Analysis<br>Mode";
    d3.select("#queryControls")
      .style("display", "none");

    d3.select("#gridLegend")
      .style("display", "none");

      d3.select("#tractMid")
      .style("display", "initial");

    d3.select("#tractName")
      .text("Change");

    d3.selectAll(".currSelection")
      .style("display", "none");
    d3.selectAll(".bin").remove();

    d3.select("#tractLegend")
      .style("background", "linear-gradient(to right, #542788, #f7f7f7, #b35806)");

    d3.select(".leaflet-areaselect-container")
      .style("display", "none");

    dataRequest(time.make(), useData);

  } else if (mode === "time") {
    mode = "query";

    // areaSelect.addTo(map);
    // areaSelect.on("change", function() {
    //   d3.selectAll(".currSelection").remove();
    //   var bounds = selectionBounds = this.getBounds();

    //   selectionBG = L.rectangle(bounds, {color: "#de2d26", weight: 1, className: "currSelection"}).addTo(map);
    // });

    d3.select("#modeTitle").node()
      .innerHTML = "Query<br>Mode";
    d3.select("#queryControls")
      .style("display", "initial");

    d3.select("#gridLegend")
    .style("display", "initial");

    d3.select("#tractMid")
      .style("display", "none");

    d3.select("#tractName")
      .text("Tract");

    // dest
    d3.select("#tractLegend")
      .style("background", queryMode === "queryOrig" ? 
        "linear-gradient(to right, #fee0b6, #f1a340, #b35806)" : // origin
        "linear-gradient(to right, #d8daeb, #998ec3, #542788)"); // destination


    d3.selectAll(".currSelection")
      .style("display", "initial");

    d3.select(".leaflet-areaselect-container")
      .style("display", "initial");
  }
}

var useData = function(pe, data) {
  if (mode === "query") {
    var withinVar = "";
    var notWithinVar = "";

    if (queryMode === "queryOrig") {
      withinVar = "pickup_centroid_location";
      notWithinVar = "dropoff_census_tract";

      tractColorScale.range(["#fee0b6", "#f1a340", "#b35806"]);
      binColorScale.range(["#998ec3", "#542788"]);

      d3.select("#tractLegend")
        .style("background", "linear-gradient(to right, #fee0b6, #f1a340, #b35806)");
      d3.select("#gridLegend")
        .style("background", "linear-gradient(to right, #998ec3, #542788)");
        
    } else {
      withinVar = "dropoff_centroid_location";
      notWithinVar = "pickup_census_tract";

      tractColorScale.range(["#d8daeb", "#998ec3", "#542788"]);
      binColorScale.range(["#f1a340", "#b35806"]);

      d3.select("#tractLegend")
        .style("background", "linear-gradient(to right, #d8daeb, #998ec3, #542788)");
      d3.select("#gridLegend")
        .style("background", "linear-gradient(to right, #f1a340, #b35806)");
    }

    console.log(pe);
    var filtered = data.filter((el) => el.dropoff_centroid_location && el.pickup_centroid_location)

    for (obj of objects) {
      obj.remove();
    }
    objects = [];

    d3.selectAll(".censusTract")
      .style("fill-opacity", 0)
      .style("stroke", "none")
      .classed("isVisible", false);

    var tractAggregate = {};

    var binResolution = d3.max([0, Math.round(areaSelect._width / 20)]);
    var binWidth = (selectionBounds._northEast.lng - selectionBounds._southWest.lng) / binResolution,
      binHeight = (selectionBounds._southWest.lat - selectionBounds._northEast.lat) / binResolution;

    var lngMin = selectionBounds._southWest.lng;
    var latMin = selectionBounds._northEast.lat;

    var binsAggregate = new Array(binResolution);

    for(var i = 0; i < binResolution; i++) {
      binsAggregate[i] = new Array(binResolution).fill(0);
    }


    // iterate through items and aggregate values
    for (var el of filtered) {
      // aggregate tract destinations
      if (!tractAggregate.hasOwnProperty(el[notWithinVar])) {
        tractAggregate[el[notWithinVar]] = 0;
      }
      tractAggregate[el[notWithinVar]]++;


      // aggregate bin origins
      var x = Math.floor(binResolution * ((selectionBounds._northEast.lng - el[withinVar].coordinates[0]) / 
          (selectionBounds._northEast.lng - selectionBounds._southWest.lng)));
        y = Math.floor(binResolution * ((selectionBounds._southWest.lat - el[withinVar].coordinates[1]) / 
          (selectionBounds._southWest.lat - selectionBounds._northEast.lat)));

      if (x < binResolution && x >= 0 && y < binResolution && y >= 0) {
        binsAggregate[x][y]++;
      }

    }

    // define color scales
    var tractExtent = d3.extent(Object.keys(tractAggregate), (el) => tractAggregate[el]);
    tractColorScale.domain([tractExtent[0], (tractExtent[1] + tractExtent[0]) / 2, tractExtent[1]]);

    var binMin = d3.min(binsAggregate, (el) => {
        return d3.min(el.filter((v) => v > 0));
        // return d3.min(el);
      }),
      binMax = d3.max(binsAggregate, (el) => {
        // return d3.max(el.filter((v) => v > 0));
        return d3.max(el);
      });

    // binColorScale.domain([binMin, (binMax + binMin) / 2, binMax]); 
    binColorScale.domain([binMin, binMax]); 

    d3.select("#tractMax")
      .text(tractExtent[1]);

    d3.select("#tractMin")
      .text(tractExtent[0]);

    d3.select("#gridMax")
      .text(binMax);

    d3.select("#gridMin")
      .text(binMin);


    // draw information onto map
    for(var t in tractAggregate) {
      d3.selectAll(".tract" + t)
        .style("fill", function(d) {
          return tractColorScale(tractAggregate[t]);
        })
        .style("fill-opacity", 0.5)
        .style("stroke", "black")
        .classed("isVisible", true);
    }

    for (var i = 0; i < binResolution; i++) { // y
      for (var j = 0; j < binResolution; j++) { // x
        var binBounds = [[latMin + (i*binHeight), lngMin + ((binResolution - j - 1)*binWidth)], [latMin + ((i + 1)*binHeight), lngMin + ((binResolution - j)*binWidth)]];

        L.rectangle(binBounds,
          {
            fillColor: binColorScale(binsAggregate[j][i]), 
            color: binsAggregate[j][i] === 0 ? "gray": "white",
            weight: binsAggregate[j][i] === 0 ? 0.5: 2,
            className: "bin bin" + j + "_" + i,
            // opacity: binsAggregate[j][i] === 0 ? 0 : 1,
            fillOpacity: binsAggregate[j][i] === 0 ? 0 : 0.5
          })
        .addTo(map);
      }
    }

    for (var i = 0; i < binResolution; i++) { // y
      for (var j = 0; j < binResolution; j++) { // x
        if (binsAggregate[j][i] > 0) {
          d3.select(".bin" + j + "_" + i)
            .node().parentNode.appendChild(d3.select(".bin" + j + "_" + i).node());
        }
      }
    }
  } else if (mode === "time") {
    d3.selectAll(".censusTract")
      .style("fill-opacity", 0)
      .style("stroke", "none")
      .classed("isVisible", false);

    // withinVar = "dropoff_centroid_location";
    // notWithinVar = "pickup_census_tract";

    // tractColorScale.range(["#d8daeb", "#998ec3", "#542788"]);
    // binColorScale.range(["#f1a340", "#b35806"]);

    // event time
    // 2015-01-02T12:00:00

    var startDate = new Date("2015-01-01T12:00:00"),
      endDate = new Date("2015-01-03T12:00:00");

    var numTimesteps = (endDate.getTime() - startDate.getTime()) / (15 * 60000) + 1;

    var timesteps = {};

    // 15 minute intervals (trips are on 15 minute intervals also)
    // for (var t = startDate.getTime(); t <= endDate.getTime(); t += (15 * 60000)) {
    //   timesteps["" + t] = {pickup: 0, dropoff: 0};
    // }


    var event = "2015-01-02T12:00:00";
    var eventTime = new Date(event).getTime();


    var filtered = data.filter((el) => el.dropoff_census_tract && el.pickup_census_tract);

    var aggregated = time.aggregated = {};

    for (var t of filtered) {
      if (!aggregated[t.pickup_census_tract]) {
        aggregated[t.pickup_census_tract] = {
          before: {pickup: 0, dropoff: 0},
          after: {pickup: 0, dropoff: 0},
          // byTime: Object.assign({}, timesteps)
          // byTime: {}
          byTime: new Array(numTimesteps)
        }

        // for (var key in Object.keys(timesteps)) {
        //   aggregated[t.pickup_census_tract].byTime[key] = {pickup: 0, dropoff: 0};
        // }

        for (var i = 0; i < numTimesteps; i++) {
          aggregated[t.pickup_census_tract].byTime[i] = {pickup: 0, dropoff: 0};
        }

      }

      if (!aggregated[t.dropoff_census_tract]) {
        aggregated[t.dropoff_census_tract] = {
          before: {pickup: 0, dropoff: 0},
          after: {pickup: 0, dropoff: 0},
          // byTime: Object.assign({}, timesteps)
          // byTime: {}
          byTime: new Array(numTimesteps)
        }

        // for (var key in Object.keys(timesteps)) {
        //   aggregated[t.dropoff_census_tract].byTime[key] = {pickup: 0, dropoff: 0};
        // }
      
        for (var i = 0; i < numTimesteps; i++) {
          aggregated[t.dropoff_census_tract].byTime[i] = {pickup: 0, dropoff: 0};
        }
      }

      var tripStart = new Date(t.trip_start_timestamp).getTime();
      var tripEnd = new Date(t.trip_end_timestamp).getTime();

      // save trip start if within window 
      if (tripStart <= endDate.getTime() && tripStart >= startDate.getTime()) {
        aggregated[t.pickup_census_tract].byTime[Math.round((endDate.getTime() - tripStart) / (15*60000))].pickup++;

        if (tripStart < eventTime) {
          aggregated[t.pickup_census_tract].before.pickup++;
        } else {
          aggregated[t.pickup_census_tract].after.pickup++;
        }
      }

      // save trip end
      if (tripEnd <= endDate.getTime() && tripEnd >= startDate.getTime()) {
        aggregated[t.dropoff_census_tract].byTime[Math.round((endDate.getTime() - tripEnd) / (15*60000))].dropoff++;

        if (tripEnd < eventTime) {
          aggregated[t.dropoff_census_tract].before.dropoff++;
        } else {
          aggregated[t.dropoff_census_tract].after.dropoff++;
        }
      }
    }

    var changeExtent = d3.extent(Object.keys(aggregated), 
      t => (aggregated[t].after.pickup + aggregated[t].after.dropoff) - (aggregated[t].before.pickup + aggregated[t].before.dropoff));

    changeColorScale.domain([changeExtent[0], 0, changeExtent[1]]);

    d3.select("#tractMax")
      .text(changeExtent[1]);

    d3.select("#tractMin")
      .text(changeExtent[0]);

    for(var t of Object.keys(aggregated)) {
      var change = (aggregated[t].after.pickup + aggregated[t].after.dropoff) - (aggregated[t].before.pickup + aggregated[t].before.dropoff);
  
      d3.select(".tract" + t)
        .style("fill", changeColorScale(change))
        .style("fill-opacity", 0.5)
        .style("stroke", "black")
        .classed("isVisible", true);
    }

  }
};

// method to request data
function dataRequest(query, callback) {
  disableInteraction(map);

  var xhr = new XMLHttpRequest();
  xhr.open("GET", query);

  xhr.onprogress = function(pe) {
    if (pe.lengthComputable) {
      console.log("Progress", pe.loaded / pe.total);
    }
  };

  xhr.onloadend = function(pe) {
    if (callback) {
      console.log(JSON.parse(xhr.response).length);

      enableInteraction(map);
      d3.selectAll(".currSelection")
        // .style("fill", "#31a354")
        .style("stroke", "#31a354")
        .style("stroke-width", 3)
        .style("fill-opacity", 0);

      callback(pe, JSON.parse(xhr.response));
    }
  };

  xhr.send();
}

function disableInteraction(map) {
  map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();
  if (map.tap) map.tap.disable();
  document.getElementById('map').style.cursor='default';
}

function enableInteraction(map) {
  map.dragging.enable();
  map.touchZoom.enable();
  map.doubleClickZoom.enable();
  map.scrollWheelZoom.enable();
  map.boxZoom.enable();
  map.keyboard.enable();
  if (map.tap) map.tap.enable();
  document.getElementById('map').style.cursor='';
}
