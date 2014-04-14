(function (window, document, $, _, Backbone, undefined) {
    var app = {};

    _.extend(app, Backbone.Events);

    app.Config = {
        center: [
            31.229338896614287, 121.48333582831081
        ],
        zoom: 11,
        panoBounds: [
            31.172556493930472, 121.36806781315332, // South West
            31.260640822155956, 121.57509143375879  // North East
        ]
    };

    // View
    app.View = {
        // The panorama view
        PanoView: Backbone.View.extend({
            panorama: null,
            panoService: null,
            panoId: '',
            bounds: null,
            latLng: null,

            initialize: function (options) {
                this.bounds = options.bounds;

                this.panorama = new qq.maps.Panorama(this.el, {
                    disableMove: false,
                    disableFullScreen: true,
                    zoom:1
                });

                this.panoService = new qq.maps.PanoramaService();

                this.listenTo(app, "game:again", this.showPano);
            },

            showPano: function () {
                var self = this;
                var lat = this.bounds[0] + (this.bounds[2] - this.bounds[0]) * Math.random();
                var lng = this.bounds[1] + (this.bounds[3] - this.bounds[1]) * Math.random();
                var found = false;

                this.latLng = new qq.maps.LatLng(lat, lng);

                this.panoService.getPano(this.latLng, 1000, function (location) {
                    if (location) {
                        self.panoId = location.svid;
                        self.panorama.setPano(location.svid);
                        self.latLng = location.latlng;

                        app.trigger("pano:ready");
                    } else {
                        self.showPano();
                    }
                });
            }
        }),

        // The map view
        MapView: Backbone.View.extend({
            center: null,
            zoom: 0,
            map: null,
            marker: null,
            polygon: null,
            resultMarker: null,
            enableMarker: false,

            initialize: function (options) {
                var self = this;
                this.center = new qq.maps.LatLng(options.center[0], options.center[1]);
                this.zoom = options.zoom;
                this.map = new qq.maps.Map(this.el, {
                    center: this.center,
                    zoom: this.zoom,
                    mapTypeControl: false,
                    panControl: false,
                    zoomControl: false,
                    scaleControl: false
                });

                this.resultMarker = new qq.maps.Marker({
                    icon: new qq.maps.MarkerImage("http://open.map.qq.com/apifiles/2/1/14/theme/default/imgs/marker_red.png")
                });

                qq.maps.event.addListener(this.map, 'click', function(event) {
                    if (!self.enableMarker) {
                        return ;
                    }

                    if (!self.marker) {
                        self.marker = new qq.maps.Marker({
                            position: event.latLng,
                            map: self.map
                        });
                    } else {
                        self.marker.setMap(self.map);
                        self.marker.setPosition(event.latLng);
                    }

                    app.trigger("mark:selected", event.latLng);
                });

                this.listenTo(app, "game:again", this.reset);
                this.listenTo(app, "pano:ready", this.onPanoReady);
            },

            toggleBounds: function () {
                if (!this.polygon) {
                    var bounds = app.views.panoView.bounds;
                    this.polygon = new qq.maps.Polygon({
                        path: [
                            new qq.maps.LatLng(bounds[0], bounds[1]),
                            new qq.maps.LatLng(bounds[0], bounds[3]),
                            new qq.maps.LatLng(bounds[2], bounds[3]),
                            new qq.maps.LatLng(bounds[2], bounds[1])
                        ],
                        map: this.map
                    });
                } else {
                    this.polygon.setVisible(!this.polygon.getVisible());
                }
            },

            showResult: function (position) {
                this.resultMarker.setMap(this.map);
                this.resultMarker.setPosition(position);
                this.enableMarker = false;
            },

            onPanoReady: function () {
                this.enableMarker = true;
            },

            reset: function () {
                this.map.setCenter(this.center);
                this.map.setZoom(this.zoom);

                if (this.marker) {
                    this.marker.setMap(null);
                }

                this.enableMarker = false;
                this.resultMarker.setMap(null);
            }
        }),

        // Right panel view
        RightPanelView: Backbone.View.extend({
            isDone: false,

            events: {
                "click #btn-guess": "onClickGuess",
                "click i.fa-weibo": "shareToWeibo",
                "click i.fa-renren": "shareToRenren",
                "click i.fa-question": "showHelp"
            },

            initialize: function () {
                this.listenTo(app, "mark:selected", this.onMarkSelected);
            },

            onMarkSelected: function () {
                this.$("#btn-guess").removeClass("pure-button-disabled");
            },

            onClickGuess: function () {
                if (!app.views.mapView.marker) {
                    return ;
                }

                if (this.isDone) {
                    this.$("#result").hide();
                    this.$("#btn-guess").text("查看答案");
                    app.trigger("game:again");
                    this.isDone = false;
                    return ;
                }

                var guessed = app.views.mapView.marker.getPosition();
                var showed = app.views.panoView.latLng;

                app.views.mapView.showResult(showed);

                var distance = qq.maps.geometry.spherical.computeDistanceBetween(guessed, showed);
                if (distance > 3000) {
                    this.$("#result").show().text("开玩笑，你认识上海么？差了" + distance.toFixed(2) + "米!");
                } else {
                    distance = (distance / 1000).toFixed(2);
                    this.$("#result").show().text("哇，好厉害，只差" + distance + "公里!");
                }
                this.$("#btn-guess").text("来, 下一个!");

                this.isDone = true;
            },

            shareToWeibo: function () {
                window.open("http://service.weibo.com/share/share.php?url=" + encodeURIComponent(window.location.href) + "&title=" + encodeURIComponent(document.title));
            },

            shareToRenren: function () {
                window.open("http://share.renren.com/share/buttonshare.do?link=" + encodeURIComponent(window.location.href) + "&title=" + encodeURIComponent(document.title));
            },

            showHelp: function () {
                app.views.dialogView.render("help");
            }
        }),

        DialogView: Backbone.View.extend({
            events: {
                "click": "hide"
            },

            hide: function (e) {
                this.$el.hide();
            },

            render: function (type) {
                this.$el.show();
            }
        })
    };

    // Bootstrap
    $(document).ready(function () {
        app.views = {
            panoView: new app.View.PanoView({
                el: "#pano",
                bounds: app.Config.panoBounds
            }),

            mapView: new app.View.MapView({
                el: "#map",
                center: app.Config.center,
                zoom: app.Config.zoom
            }),

            rightPanelView: new app.View.RightPanelView({
                el: "#right"
            }),

            dialogView: new app.View.DialogView({
                el: "#dialog"
            })
        };

        app.views.panoView.showPano();
        if ($.cookie("help_showed")) {
            app.views.dialogView.hide();
        } else {
            $.cookie("help_showed", 1);
        }
    });

    window.app = app;
}(window, document, jQuery, _, Backbone));
