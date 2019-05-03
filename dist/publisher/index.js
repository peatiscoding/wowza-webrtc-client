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
var SDPMessageProcessor_1 = require("./SDPMessageProcessor");
var lodash_1 = require("lodash");
var utils_1 = require("../utils");
var WebRTCPublisher = /** @class */ (function () {
    function WebRTCPublisher(config, mediaStreamConstraints, statusListener) {
        var _this = this;
        this.config = config;
        this.statusListener = statusListener;
        this.userAgent = navigator.userAgent;
        this.currentContraints = {
            video: true,
            audio: true
        };
        this.peerConnection = undefined; // if set, we are publishing.
        this.wsConnection = undefined;
        this.userData = { param1: "value1" };
        this.videoElement = undefined;
        this.statusCameraMuted = true;
        this._lastError = undefined;
        // Validate if browser support getUserMedia or not?
        if (!utils_1.supportGetUserMedia()) {
            throw new Error('Your browser does not support getUserMedia API');
        }
        // Normalize window/navigator APIs
        navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
        window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
        window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
        window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
        window.URL = window.URL || window.webkitURL;
        // Update constraints.
        this.currentContraints = mediaStreamConstraints;
        console.log('WebRTC Handler started (agent=', this.userAgent, this.currentContraints, ')');
        utils_1.queryForCamera(this.streamSourceConstraints)
            .then(function (hasCamera) { return _this.isCameraMuted = !hasCamera; })
            .catch(function (error) {
            console.error('[Publisher] Unable to locate Camera', error);
        });
    }
    Object.defineProperty(WebRTCPublisher.prototype, "isHolding", {
        /**
         * Holding = disable microphone only.
         */
        get: function () {
            if (!this.localStream) {
                return false;
            }
            var audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length > 0) {
                return !audioTracks[0].enabled;
            }
            return false;
        },
        set: function (value) {
            if (!this.localStream) {
                return;
            }
            lodash_1.forEach(this.localStream.getAudioTracks(), function (track) { track.enabled = !value; });
            this.statusListener && this.statusListener();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WebRTCPublisher.prototype, "isCameraMuted", {
        get: function () {
            return this.statusCameraMuted;
        },
        set: function (muted) {
            this.statusCameraMuted = muted;
            this.statusListener && this.statusListener();
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WebRTCPublisher.prototype, "isPublishing", {
        get: function () {
            return !!this.peerConnection;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WebRTCPublisher.prototype, "isPreviewEnabled", {
        get: function () {
            return !!this.videoElement && (!!this.videoElement.src || !!this.videoElement.srcObject);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WebRTCPublisher.prototype, "streamSourceConstraints", {
        get: function () {
            return this.currentContraints;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(WebRTCPublisher.prototype, "lastError", {
        get: function () {
            return this._lastError;
        },
        enumerable: true,
        configurable: true
    });
    WebRTCPublisher.prototype.switchStream = function (constraints) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.currentContraints = constraints;
                        // Disable current stream before claiming a new one.
                        if (this.localStream) {
                            // stop current tracks
                            if (this.localStream.stop) {
                                this.localStream.stop();
                            }
                            else {
                                this.localStream.getTracks().forEach(function (o) { return o.stop(); });
                            }
                        }
                        return [4 /*yield*/, this._claimMedia(constraints)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Attach user media to configured VideoElement
     */
    WebRTCPublisher.prototype.attachUserMedia = function (videoElement) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // save videoElement
                        this.videoElement = videoElement;
                        // Claim the stream
                        return [4 /*yield*/, this._claimMedia(this.streamSourceConstraints)];
                    case 1:
                        // Claim the stream
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    WebRTCPublisher.prototype._claimMedia = function (constraints) {
        return __awaiter(this, void 0, void 0, function () {
            var stream, peerConnection;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, utils_1.getUserMedia(constraints)
                        // Camera is not muted. (Camera is available.)
                    ];
                    case 1:
                        stream = _a.sent();
                        // Camera is not muted. (Camera is available.)
                        this.isCameraMuted = false;
                        // If videoElement exists - attach it.
                        if (this.videoElement) {
                            try {
                                this.videoElement.srcObject = stream;
                            }
                            catch (elementError) {
                                console.error('[Publisher] attaching video.srcObject failed, Fallback to src ...', this.videoElement, stream);
                                this.videoElement.src = window.URL.createObjectURL(stream);
                            }
                        }
                        peerConnection = this.peerConnection;
                        if (peerConnection) {
                            // Replace track
                            stream.getTracks().forEach(function (track) {
                                var sender = peerConnection.getSenders().find(function (sender) {
                                    return sender.track && sender.track.kind == track.kind || false;
                                });
                                sender && sender.replaceTrack(track);
                            });
                        }
                        // Select the stream to Local Stream.
                        this.localStream = stream;
                        // status updated.
                        this.statusListener && this.statusListener();
                        return [2 /*return*/, stream];
                }
            });
        });
    };
    WebRTCPublisher.prototype.detachUserMedia = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.localStream) {
                    if (this.videoElement && this.videoElement.src) {
                        this.videoElement.src = '';
                    }
                    if (this.videoElement && this.videoElement.srcObject) {
                        this.videoElement.srcObject = null;
                    }
                    this._stopStream();
                    this.statusListener && this.statusListener();
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Begin connect to server, and publish the media.
     */
    WebRTCPublisher.prototype.connect = function (streamName) {
        return __awaiter(this, void 0, void 0, function () {
            var conf, wsURL, streamInfo, videoBitrate, audioBitrate, videoFrameRate, wsConnection;
            var _this = this;
            return __generator(this, function (_a) {
                if (this.peerConnection) {
                    throw new Error('There is already active peerConnection!');
                }
                conf = this.config;
                wsURL = conf.WEBRTC_SDP_URL;
                streamInfo = {
                    applicationName: conf.WEBRTC_APPLICATION_NAME,
                    streamName: streamName,
                    sessionId: "[empty]" // random me!
                };
                videoBitrate = conf.WEBRTC_VIDEO_BIT_RATE;
                audioBitrate = conf.WEBRTC_AUDIO_BIT_RATE;
                videoFrameRate = conf.WEBRTC_FRAME_RATE;
                wsConnection = new WebSocket(wsURL);
                wsConnection.binaryType = 'arraybuffer';
                wsConnection.onopen = function () { return __awaiter(_this, void 0, void 0, function () {
                    var localStream, err, peerConnection, pc, localTracks, localTrack, description, enhancer, error_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                console.log('[Publisher] wsConnection.onopen');
                                localStream = this.localStream;
                                if (!localStream) {
                                    err = new Error('Invalid state, open connection without video stream to publish.');
                                    this._reportError(err);
                                    throw err;
                                }
                                peerConnection = new RTCPeerConnection({ iceServers: [] });
                                peerConnection.onicecandidate = function (event) {
                                    if (event.candidate != null) {
                                        console.log("[Publisher] gotIceCandidate: " + JSON.stringify({ 'ice': event.candidate }));
                                    }
                                };
                                pc = peerConnection;
                                if (!pc.addStream) {
                                    {
                                        localTracks = localStream.getTracks();
                                        for (localTrack in localTracks) {
                                            peerConnection.addTrack(localTracks[localTrack], localStream);
                                        }
                                    }
                                }
                                else {
                                    pc.addStream(localStream);
                                }
                                _a.label = 1;
                            case 1:
                                _a.trys.push([1, 4, , 5]);
                                return [4 /*yield*/, peerConnection.createOffer()
                                    // enhance sdp message
                                ];
                            case 2:
                                description = _a.sent();
                                enhancer = new SDPMessageProcessor_1.SDPMessageProcessor('42e01f', // VideoMode: 'H264=42e01f' or 'VP9=VP9'
                                'opus' // AudioMode: 'OPUS'
                                );
                                description.sdp = enhancer.enhance(description.sdp, {
                                    audioBitrate: audioBitrate,
                                    videoBitrate: videoBitrate,
                                    videoFrameRate: videoFrameRate
                                });
                                return [4 /*yield*/, peerConnection.setLocalDescription(description)
                                    // send offer back with enhanced SDP
                                ];
                            case 3:
                                _a.sent();
                                // send offer back with enhanced SDP
                                wsConnection.send('{"direction":"publish", "command":"sendOffer", "streamInfo":' + JSON.stringify(streamInfo) + ', "sdp":' + JSON.stringify(description) + ', "userData":' + JSON.stringify(this.userData) + '}');
                                this.peerConnection = peerConnection;
                                this.statusListener && this.statusListener();
                                console.log('[Publisher] Publishing with streamName=', streamName);
                                return [3 /*break*/, 5];
                            case 4:
                                error_1 = _a.sent();
                                console.error('Failed while waiting for offer result', error_1);
                                this._reportError(error_1);
                                return [3 /*break*/, 5];
                            case 5: return [2 /*return*/];
                        }
                    });
                }); };
                wsConnection.onmessage = function (evt) { return __awaiter(_this, void 0, void 0, function () {
                    var err, peerConnection, msgJSON, msgStatus, msgCommand, err, sdpData, iceCandidates, _a, _b, _i, index;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                if (!this.peerConnection) {
                                    err = new Error('Invalid state! peerConnection is empty!');
                                    this._reportError(err);
                                    throw err;
                                }
                                peerConnection = this.peerConnection;
                                msgJSON = JSON.parse(evt.data);
                                msgStatus = Number(msgJSON['status']);
                                msgCommand = msgJSON['command'];
                                console.log('Incoming message', msgCommand);
                                if (msgStatus != 200) {
                                    err = new Error("Failed to publish, cannot handle invalid status: " + msgStatus);
                                    this._reportError(err);
                                    return [2 /*return*/];
                                }
                                sdpData = msgJSON['sdp'];
                                if (!(sdpData !== undefined)) return [3 /*break*/, 2];
                                console.log("[Publisher] sdp: " + sdpData);
                                return [4 /*yield*/, peerConnection.setRemoteDescription(new RTCSessionDescription(sdpData))];
                            case 1:
                                _c.sent();
                                _c.label = 2;
                            case 2:
                                iceCandidates = msgJSON['iceCandidates'];
                                if (!(iceCandidates !== undefined)) return [3 /*break*/, 6];
                                _a = [];
                                for (_b in iceCandidates)
                                    _a.push(_b);
                                _i = 0;
                                _c.label = 3;
                            case 3:
                                if (!(_i < _a.length)) return [3 /*break*/, 6];
                                index = _a[_i];
                                console.log('[Publisher] iceCandidates: ' + iceCandidates[index]);
                                return [4 /*yield*/, peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidates[index]))];
                            case 4:
                                _c.sent();
                                _c.label = 5;
                            case 5:
                                _i++;
                                return [3 /*break*/, 3];
                            case 6:
                                // Connected! SDP Connection is no longer required.
                                if (wsConnection != null) {
                                    wsConnection.close();
                                }
                                return [2 /*return*/];
                        }
                    });
                }); };
                wsConnection.onclose = function () { return console.log('[Publisher] wsConnection.onclose'); };
                wsConnection.onerror = function (evt) {
                    console.log("[Publisher] wsConnection.onerror: " + JSON.stringify(evt));
                    _this._reportError(new Error(JSON.stringify(evt)));
                };
                // save it.
                this.wsConnection = wsConnection;
                return [2 /*return*/];
            });
        });
    };
    WebRTCPublisher.prototype._reportError = function (error) {
        this._lastError = error;
        this.disconnect();
    };
    WebRTCPublisher.prototype.disconnect = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.peerConnection && this.peerConnection.close();
                this.wsConnection && this.wsConnection.close();
                this.peerConnection = undefined;
                this.wsConnection = undefined;
                this._stopStream();
                this.statusListener && this.statusListener();
                console.log("[Publisher] Disconnected");
                return [2 /*return*/];
            });
        });
    };
    WebRTCPublisher.prototype._stopStream = function () {
        // if there is a localStream object, and they are no longer used.
        if (this.localStream && !this.isPreviewEnabled && !this.isPublishing) {
            console.log('[Publisher] Trying to stop stream', this.localStream);
            if (this.localStream.stop) {
                this.localStream.stop();
            }
            else {
                for (var _i = 0, _a = this.localStream.getTracks(); _i < _a.length; _i++) {
                    var track = _a[_i];
                    track.stop();
                }
            }
            this.localStream = undefined;
        }
    };
    return WebRTCPublisher;
}());
exports.WebRTCPublisher = WebRTCPublisher;
