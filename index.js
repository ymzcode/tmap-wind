import {
    WindCore,
    isArray,
    formatData,
    defaultOptions,
    assign,
} from "wind-core";

// 检查当前环境是否已经引入天地图
if (!window.T) {
    throw new Error("没有引入天地图js");
}

const TMapWind = window.T.Overlay.extend({
    // 构造函数时传递参数，对OverlayOptions属性值进行赋值。
    initialize: function (data, options) {
        this.map = null;
        this.options = options;
        this.paneName = "overlayPane";
        this.context = "2d";
        this.zIndex = 999999;
        this.mixBlendMode = "normal";
        this.field = null;

        // 矢量图层
        this.canvas = null;
        this.wind = null;

        // 注册函数
        this.adjustSize = () => {
            const size = this.map.getSize();
            const canvas = this.canvas;
            const devicePixelRatio = window.devicePixelRatio || 1;

            if (canvas !== null) {
                canvas.width = size.x * devicePixelRatio;
                canvas.height = size.y * devicePixelRatio;
                if (this.context === "2d") {
                    canvas
                        .getContext(this.context)
                        .scale(devicePixelRatio, devicePixelRatio);
                }
                canvas.style.width = size.x + "px";
                canvas.style.height = size.y + "px";
            }
        };

        this._draw = () => {
            const map = this.map;
            const size = map.getSize();
            const center = map.getCenter();
            if (center && this.canvas) {
                const pixel = map.lngLatToLayerPoint(center);
                this.canvas.style.left = pixel.x - size.x / 2 + "px";
                this.canvas.style.top = pixel.y - size.y / 2 + "px";
                this._render(this.canvas);
            }
        };

        this.getContext = () => {
            if (this.canvas === null) return;
            return this.canvas.getContext(this.context);
        };

        this.pickWindOptions = () => {
            Object.keys(defaultOptions).forEach((key) => {
                if (key in this.options) {
                    if (this.options.windOptions === undefined) {
                        this.options.windOptions = {};
                    }
                    // @ts-ignore
                    this.options.windOptions[key] = this.options[key];
                }
            });
        };

        this.startAndDraw = () => {
            this.start();
            this._draw();
        };

        this.updateParams = (options) => {
            this.setWindOptions(options);
            return this;
        };

        this.start = this.start.bind(this);
        this.stop = this.stop.bind(this);
        this.handleResize = this.handleResize.bind(this);

        this.pickWindOptions();

        console.log("设置项目", this.options);

        if (data) {
            this.setData(data, options.fieldOptions);
        }
    },
    onAdd: function (map) {
        this.map = map;
        const canvas = (this.canvas = document.createElement("canvas"));
        canvas.style.cssText = `position:absolute; left:0; top:0; z-index: ${this.zIndex} ;user-select:none;`;
        canvas.style.mixBlendMode = this.mixBlendMode;
        this.adjustSize();
        map.getPanes()[this.paneName].appendChild(canvas);
        this.bindEvent();
        this._draw();
        return this.canvas;
    },

    _render: function (canvas) {
        if (!this.getData() || !this.map) return this;
        const opt = this.getOptimizeWindOptions();

        if (canvas && !this.wind) {
            const data = this.getData();
            const ctx = this.getContext();

            if (ctx) {
                this.wind = new WindCore(ctx, opt, data);

                this.wind.project = this.project.bind(this);
                this.wind.unproject = this.unproject.bind(this);
                this.wind.intersectsCoordinate = this.intersectsCoordinate.bind(this);
                this.wind.postrender = () => {
                    // @ts-ignore
                    // this.setCanvasUpdated();
                };
            }
        }

        if (this.wind) {
            this.wind.setOptions(this.options.windOptions);
            this.wind.prerender();
            this.wind.render();
        }

        return this;
    },
    setWindOptions: function (options) {
        const beforeOptions = this.options.windOptions || {};
        this.options = assign(this.options, {
            windOptions: assign(beforeOptions, options || {}),
        });

        if (this.wind) {
            this.wind.setOptions(this.options.windOptions);
            this.wind.prerender();
        }
    },
    bindEvent: function () {
        this.map.addEventListener("resize", this.handleResize);

        this.map.addEventListener("movestart", this.stop);
        this.map.addEventListener("moveend", this.startAndDraw);
    },

    // 获取优化过后的配置项
    getOptimizeWindOptions: function () {
        const velocityScales = {
            0: 1 / 20,
            1: 1 / 20,
            2: 1 / 20,
            3: 1 / 30,
            4: 1 / 40,
            5: 1 / 50,
            6: 1 / 60,
            7: 0.003,
            8: 0.002,
            9: 0.001,
            10: 0.0005,
            11: 0.0003,
            12: 0.00015,
            13: 0.0001,
            14: 0.00005,
            15: 0.000025,
            16: 0.00001,
            17: 0.000005,
            18: 0.000002,
        };

        // 自动优化配置
        const beforeOptions = this.options.windOptions || {};

        const zoom = this.map.getZoom();
        const options = {
            velocityScale: velocityScales[zoom] || 1 / 200,
            paths: zoom >= 8 ? 3000 : 5000,
        };

        this.options = assign(this.options, {
            windOptions: assign(beforeOptions, options || {}),
        });
        return this.options.windOptions || {};
    },
    getWindOptions: function () {
        return this.options.windOptions || {};
    },
    onRemove: function () {
        console.log("执行删除");
        const parent = this.div.parentNode;
        if (parent) {
            parent.removeChild(this.div);
            this.map = null;
            this.div = null;
        }
    },
    start: function () {
        if (this.wind) {
            console.log("start");
            this.wind.start();
        }
    },
    stop: function () {
        if (this.wind) {
            console.log("stop");
            this.wind.stop();
        }
    },
    handleResize: function () {
        console.log("可是区域变化");
        this.adjustSize();
        this._draw();
    },
    setData: function (data, options = {}) {
        if (data && data.checkFields && data.checkFields()) {
            this.field = data;
        } else if (isArray(data)) {
            this.field = formatData(data, options);
        } else {
            console.error("Illegal data");
        }

        console.log("查看数据是否赋值", this.field);

        // 第一次不会走这里
        if (this.map && this.canvas && this.field) {
            this?.wind?.updateData(this.field);
            this._render(this.canvas);
        }

        return this;
    },
    getData: function () {
        return this.field;
    },
    project: function (coordinate) {
        // console.log('project ', coordinate)
        const pixel = this.map.lngLatToContainerPoint(
            new window.T.LngLat(coordinate[0], coordinate[1])
        );
        // const mercatorCoordinates = this.transferToMercator(coordinate);
        // console.log(pixel)
        return [pixel.x, pixel.y];
    },
    unproject: function (pixel) {
        // console.log('unproject', pixel)
        const coords = this.map.containerPointToLngLat(
            new window.T.Point(pixel[0], pixel[1])
        );
        // console.log(coords)
        return [coords.lng, coords.lat];
    },
    intersectsCoordinate: function (coordinate) {
        // console.log('intersectsCoordinate', coordinate)
        const mapExtent = this.map.getBounds();
        const bool = mapExtent.contains(
            new window.T.LngLat(coordinate[0], coordinate[1])
        );
        // console.log(bool)
        return bool;
    },
    /**
     * 更新位置
     */
    update: function () {
        console.log("chonghui");
        this._draw();
    },
});

const WindLayer = TMapWind;

export { WindLayer };

export default TMapWind;