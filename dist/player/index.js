"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_1 = require("lodash");
var utils_1 = require("../utils");
// Normalize all platform dependencies
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
var WebRTCPlayer = /** @class */ (function () {
    function WebRTCPlayer(config, hostElement, onStateChanged) {
        // do something
        var _this = this;
        this.config = config;
        this.hostElement = hostElement;
        this.onStateChanged = onStateChanged;
        this.userData = { param1: "value1" };
        this.peerConnection = undefined;
        // As for mobile .. allow autoPlay, always muted the audio by default.
        if (utils_1.isMobileBrowser()) {
            this.hostElement.muted = true;
        }
        this.hostElement.onplay = function () {
            _this._reportStatus();
        };
    }
    Object.defineProperty(WebRTCPlayer.prototype, "isMuted", {
        get: function () {
            if (!this.hostElement) {
                return undefined;
            }
            return this.hostElement.muted;
        },
        set: function (value) {
            if (!this.hostElement) {
                throw new Error('Unable to configure isMuted.');
            }
            if (value === undefined) {
                throw new Error('Unable to configure undefined as muted.');
            }
            this.hostElement.muted = value;
            this._reportStatus();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WebRTCPlayer.prototype, "isPlaying", {
        get: function () {
            return !!this.peerConnection;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Connect to WebRTC source, acquire media, and attach to target videoElement.
     *
     * @param streamName
     */
    WebRTCPlayer.prototype.connect = function (streamName) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.peerConnection) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.stop()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        // connect
                        this.connecting = utils_1.cancellable((function (resolve, reject, defineCanceller) {
                            var conf = _this.config;
                            var streamInfo = {
                                applicationName: conf.WEBRTC_APPLICATION_NAME,
                                streamName: streamName,
                                sessionId: "[empty]" // random me!
                            };
                            var wsConnection = new WebSocket(conf.WEBRTC_SDP_URL);
                            wsConnection.binaryType = 'arraybuffer';
                            var _assignStream = function (stream) {
                                console.info('[Player] Assigning stream', stream);
                                try {
                                    _this.hostElement.srcObject = stream;
                                }
                                catch (error) {
                                    console.warn('[Player] Unable to assign stream: ', stream, 'to element:', _this.hostElement, 'because', error);
                                    _this.hostElement.src = window.URL.createObjectURL(stream);
                                }
                            };
                            var _sendGetOffer = function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    wsConnection.send('{"direction":"play", "command":"getOffer", "streamInfo":' + JSON.stringify(streamInfo) + ', "userData":' + JSON.stringify(this.userData) + '}');
                                    return [2 /*return*/];
                                });
                            }); };
                            wsConnection.onopen = function () {
                                //
                                console.log('[Player] onopen');
                                var peerConnection = new RTCPeerConnection({ iceServers: [] });
                                peerConnection.onicecandidate = function (event) {
                                    console.log('[Player] onicecandidate', event);
                                };
                                // Test if onaddstream available?
                                var pc = peerConnection;
                                // ontrack is available.
                                if (typeof pc.ontrack !== 'undefined') {
                                    peerConnection.ontrack = function (ev) {
                                        console.log('[Player] gotRemoteTrack: kind: ' + ev.track.kind + ' stream: ' + ev.streams[0]);
                                        // Assign track to remoteVideo
                                        _assignStream(ev.streams[0]);
                                    };
                                }
                                else {
                                    pc.onaddstream = function (event) {
                                        console.log('[Player] gotRemoteStream: ', event.stream);
                                        _assignStream(event.stream);
                                    };
                                }
                                // save to instance.
                                _this.peerConnection = peerConnection;
                                _this.lastError = undefined;
                                _this._reportStatus();
                                // send 'play' request 'getOffer'
                                _sendGetOffer();
                            };
                            wsConnection.onmessage = function (evt) {
                                console.log("[Player] wsConnection.onmessage: " + evt.data);
                                // sanity check
                                if (!_this.peerConnection) {
                                    var err = new Error('Invalid state, peer connection is expected.');
                                    reject(err);
                                    return;
                                }
                                var peerConnection = _this.peerConnection;
                                var msgJSON = JSON.parse(evt.data);
                                var msgStatus = +msgJSON.status;
                                var msgCommand = msgJSON.command;
                                var repeaterRetryCount = 0;
                                if (msgStatus === 514) { // repeater stream not ready
                                    repeaterRetryCount++;
                                    if (repeaterRetryCount < 10) {
                                        setTimeout(_sendGetOffer, 500);
                                    }
                                    else {
                                        reject(new Error('Auto retry exhausted'));
                                    }
                                }
                                else if (msgStatus != 200) {
                                    console.log('[Player] SDP Data Tag ...', msgJSON.statusDescription);
                                    reject(new Error(msgJSON.statusDescription));
                                }
                                else {
                                    streamInfo.sessionId = lodash_1.get(msgJSON, 'streamInfo.sessionId', undefined);
                                    var sdpData = lodash_1.get(msgJSON, 'sdp', undefined);
                                    if (sdpData) {
                                        console.log("[Player] sdp: " + JSON.stringify(sdpData));
                                        var sessionDesc = new RTCSessionDescription(sdpData);
                                        peerConnection.setRemoteDescription(sessionDesc).then(function () { return __awaiter(_this, void 0, void 0, function () {
                                            var sessionDescInit;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        console.log('[Player] Received Remote Description -> Create answer');
                                                        return [4 /*yield*/, peerConnection.createAnswer()];
                                                    case 1:
                                                        sessionDescInit = _a.sent();
                                                        console.log('[Player] Set Local Description');
                                                        return [4 /*yield*/, peerConnection.setLocalDescription(sessionDescInit)];
                                                    case 2:
                                                        _a.sent();
                                                        console.log('[Player] Send Answer');
                                                        wsConnection.send('{"direction":"play", "command":"sendResponse", "streamInfo":' + JSON.stringify(streamInfo) + ', "sdp":' + JSON.stringify(sessionDescInit) + ', "userData":' + JSON.stringify(this.userData) + '}');
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); });
                                    }
                                    var iceCandidates = msgJSON.iceCandidates;
                                    if (iceCandidates !== undefined) {
                                        for (var index in iceCandidates) {
                                            console.log("[Player] iceCandidates: " + JSON.stringify(iceCandidates[index]));
                                            peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidates[index]));
                                        }
                                    }
                                }
                                // Finalize wsConnection required
                                if ('sendResponse'.localeCompare(msgCommand) === 0) {
                                    wsConnection.close();
                                    // All done
                                    resolve();
                                }
                            };
                            wsConnection.onclose = function () { return console.log('[Player] wsConnection.onclose'); };
                            wsConnection.onerror = function (evt) {
                                console.log('[Player] wsConnection.onerror: ' + JSON.stringify(evt));
                                reject(new Error(JSON.stringify(evt)));
                            };
                            defineCanceller(function () {
                                console.log('[Player] Cancel connecting promise.');
                                wsConnection.close();
                            });
                        }));
                        return [2 /*return*/, this.connecting
                                .then(function (o) {
                                _this.connecting = undefined;
                                return o;
                            })
                                .catch(function (error) {
                                _this.connecting = undefined;
                                _this._reportError(error);
                            })];
                }
            });
        });
    };
    WebRTCPlayer.prototype.stop = function () {
        // stop stream if necessary
        if (this.hostElement.srcObject) {
            this.hostElement.srcObject = null;
        }
        if (this.hostElement.src) {
            this.hostElement.src = '';
        }
        // release resources
        this.peerConnection && this.peerConnection.close();
        this.peerConnection = undefined;
        this.connecting && this.connecting.cancel();
        this._reportStatus();
        console.log('[Player] Disconnected');
    };
    WebRTCPlayer.prototype._reportError = function (error) {
        this.lastError = error;
        this.stop();
    };
    WebRTCPlayer.prototype._reportStatus = function () {
        this.onStateChanged(this.isMuted, this.isPlaying, this.lastError);
    };
    return WebRTCPlayer;
}());
exports.WebRTCPlayer = WebRTCPlayer;
