// init plot
plot = $.plot(plot_holder, {}, plot_options);
var updateLegendTimeout = null;
var latestPosition = null;
var polyMarker = null;

// updates legend with extrapolated values under the mouse position
function updateLegend() {
    var legend = $(plot_holder + " .legendLabel");
    $(plot_holder + " .legend table").css({'background-color':"rgba(255,255,255,0.9)","pointer-events":"none"});
    legend.each(function() {
        $(this).css({'padding-left':'3px'});
    });

    updateLegendTimeout = null;

    var pos = latestPosition;

    var axes = plot.getAxes();
    if (pos.x < axes.xaxis.min || pos.x > axes.xaxis.max ||
        pos.y < axes.yaxis.min || pos.y > axes.yaxis.max) {
        return;
    }

    var i, j, dataset = plot.getData();
    for (i = 0; i < dataset.length; ++i) {

        var series = dataset[i];

        // Find the nearest points, x-wise

        for (j = 0; j < series.data.length; ++j) {
            if (series.data[j][0] > pos.x) {
                break;
            }
        }

        var y;
        if(series.noInterpolate > 0) { y = series.data[((j==0)?j:j-1)][1]; }
        else {
            var p1 = (j==0) ? null : series.data[j-1];
                p2 = series.data[j];

            if (p1 == null) {
                y = p2[1];
            } else if (p2 == null) {
                y = p1[1];
            } else {
                y = p1[1] + (p2[1] - p1[1]) * (pos.x - p1[0]) / (p2[0] - p1[0]);
            }

            y = ((p1 && p1[1] == null) || (p2 && p2[1] == null)) ? null : y.toFixed(2);
        }
        legend.eq(i).text(series.label.replace(/=.*/, "= " + y));
    }

    if(!polyMarker) {
        polyMarker = new google.maps.Marker({
            clickable: false,
            flat: true,
            map: map,
            visible: true,
            icon: null
        });
    }

    if(dataset.length) {
        for (j = 0; j < dataset[0].data.length; ++j) {
            if (dataset[0].data[j][0] > pos.x) {
                break;
            }
        }
    }

    if(follow_vehicle != null && vehicles[follow_vehicle].positions.length) {
        // adjust index for null data points
        var null_count = 0;
        var data_ref = vehicles[follow_vehicle].graph_data[0];

        if(j > data_ref.data.length / 2) {
            for(var i = data_ref.data.length - 1; i > j; i--) null_count += (data_ref.data[i][1] == null) ? 1 : 0;
            null_count = data_ref.nulls - null_count * 2;
        } else {
            for(var i = 0; i < j; i++) null_count += (data_ref.data[i][1] == null) ? 1 : 0;
            null_count *= 2;
        }

        // update position
        polyMarker.setPosition(vehicles[follow_vehicle].positions[j - null_count]);

        // adjust nite overlay
        try {
            var date = new Date(data_ref.data[j][0])
        } catch(e) {
            return;
        }

        nite.setDate(date);
        nite.refresh();
        // set timebox
        $('#timebox').removeClass('present').addClass('past');
        updateTimebox(date);
    }
}

// update legend values on mouse hover
$(plot_holder).bind("plothover",  function (event, pos, item) {
    latestPosition = pos;
    plot.lockCrosshair();
    plot.setCrosshair(pos);
    if (!updateLegendTimeout) {
        updateLegendTimeout = setTimeout(updateLegend, 40);
    }
});

// double click on the plot clears selection
$(plot_holder).bind("dblclick", function () {
    if(plot_options.xaxis) delete plot_options.xaxis;
    plot = $.plot("#telemetry_graph .holder", plot.getData(), plot_options);
});

// limit range after selection
$(plot_holder).bind("plotselected", function (event, ranges) {
    if(typeof ranges.xaxis == 'undefined') return;

    plot = $.plot("#telemetry_graph .holder", plot.getData(), $.extend(true, plot_options, {
        xaxis: {
            min: ranges.xaxis.from,
            max: ranges.xaxis.to
        }
    }));
});
