import { WebRTCConfiguration } from '../interface'
import { get } from 'lodash'
import CancellablePromise, { isMobileBrowser, cancellable } from '../utils'

export interface WebRTCPlayerStatus {
  isMuted?: boolean
  isPlaying: boolean
  error?: Error
}

export class WebRTCPlayer {

  private userData = {param1:"value1"}
  private peerConnection?: RTCPeerConnection = undefined

  private lastError?: Error

  private connecting?: CancellablePromise<void>

  public get isMuted(): boolean|undefined {
    if (!this.hostElement) {
      return undefined
    }
    return this.hostElement.muted
  }

  public set isMuted(value: boolean|undefined) {
    if (!this.hostElement) {
      throw new Error('Unable to configure isMuted.')
    }
    if (value === undefined) {
      throw new Error('Unable to configure undefined as muted.')
    }
    this.hostElement.muted = value
    this._reportStatus()
  }

  public get isPlaying(): boolean {
    return !!this.peerConnection
  }

  constructor(private config: WebRTCConfiguration, private hostElement: HTMLVideoElement, private onStateChanged: (status: WebRTCPlayerStatus) => void) {
    // do something
    if (!!window) {
      // Normalize all platform dependencies
      window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
      window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate
      window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription
      window.URL = window.URL || window.webkitURL
    }

    // As for mobile .. allow autoPlay, always muted the audio by default.
    if (isMobileBrowser()) {
      this.hostElement.muted = true
    }
    this.hostElement.onplay = () => {
      this._reportStatus()
    }
  }

  /**
   * Connect to WebRTC source, acquire media, and attach to target videoElement.
   * 
   * @param streamName
   */
  async connect(streamName: string) {
    // Prevent double case
    if (this.peerConnection) {
      await this.stop()
    }
    // connect
    this.connecting = cancellable(((resolve, reject, defineCanceller) => {
      const conf: WebRTCConfiguration = this.config
      const streamInfo = {
        applicationName: conf.WEBRTC_APPLICATION_NAME,
        streamName, 
        sessionId: "[empty]"    // random me!
      }
      const wsConnection = new WebSocket(conf.WEBRTC_SDP_URL)
      wsConnection.binaryType = 'arraybuffer'

      const _assignStream = (stream: MediaStream) => {
        console.info('[Player] Assigning stream', stream)
        try {
          this.hostElement.srcObject = stream
        } catch (error) {
          console.warn('[Player] Unable to assign stream: ', stream, 'to element:', this.hostElement, 'because', error)
          this.hostElement.src = window.URL.createObjectURL(stream)
        }
      }

      const _sendGetOffer = async () => {
        wsConnection.send('{"direction":"play", "command":"getOffer", "streamInfo":'+JSON.stringify(streamInfo)+', "userData":'+JSON.stringify(this.userData)+'}')
      }

      wsConnection.onopen = () => {
        //
        console.log('[Player] onopen')
        const peerConnection = new RTCPeerConnection({ iceServers: [] })
        peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
          console.log('[Player] onicecandidate', event)
        }

        // Test if onaddstream available?
        const pc: any = peerConnection
        // ontrack is available.
        if (typeof pc.ontrack !== 'undefined') {
          peerConnection.ontrack = (ev: RTCTrackEvent) => {
            console.log('[Player] gotRemoteTrack: kind: ' + ev.track.kind + ' stream: ' + ev.streams[0])
            // Assign track to remoteVideo
            _assignStream(ev.streams[0])
          }
        } else {
          pc.onaddstream = (event: any) => {
            console.log('[Player] gotRemoteStream: ', event.stream)
            _assignStream(event.stream)
          }
        }

        // save to instance.
        this.peerConnection = peerConnection
        this.lastError = undefined
        this._reportStatus()

        // send 'play' request 'getOffer'
        _sendGetOffer()
      }

      wsConnection.onmessage = (evt: MessageEvent) => {
        console.log(`[Player] wsConnection.onmessage: ${evt.data}`);
        // sanity check
        if (!this.peerConnection) {
          const err = new Error('Invalid state, peer connection is expected.')
          reject(err)
          return
        }
      
        const peerConnection = this.peerConnection
        const msgJSON = JSON.parse(evt.data)
        
        const msgStatus = +msgJSON.status
        const msgCommand = msgJSON.command
        let repeaterRetryCount = 0

        if (msgStatus === 514) { // repeater stream not ready
          repeaterRetryCount++
          if (repeaterRetryCount < 10) {
            setTimeout(_sendGetOffer, 500);
          } else {
            reject(new Error('Auto retry exhausted'))
          }
        } else if (msgStatus != 200) {
          console.log('[Player] SDP Data Tag ...', msgJSON.statusDescription)
          reject(new Error(msgJSON.statusDescription))
        } else {
          streamInfo.sessionId = get(msgJSON, 'streamInfo.sessionId', undefined)
    
          const sdpData = get(msgJSON, 'sdp', undefined)
          if (sdpData) {
            console.log(`[Player] sdp: ${JSON.stringify(sdpData)}`)

            const sessionDesc = new RTCSessionDescription(sdpData)
            peerConnection.setRemoteDescription(sessionDesc).then(async () => {
              console.log('[Player] Received Remote Description -> Create answer')
              const sessionDescInit = await peerConnection.createAnswer()
              console.log('[Player] Set Local Description')
              await peerConnection.setLocalDescription(sessionDescInit)
              console.log('[Player] Send Answer')
              wsConnection.send('{"direction":"play", "command":"sendResponse", "streamInfo":'+JSON.stringify(streamInfo)+', "sdp":'+JSON.stringify(sessionDescInit)+', "userData":'+JSON.stringify(this.userData)+'}');
            })
          }
    
          const iceCandidates = msgJSON.iceCandidates
          if (iceCandidates !== undefined) {
            for(const index in iceCandidates) {
              console.log(`[Player] iceCandidates: ${JSON.stringify(iceCandidates[index])}`)
              peerConnection.addIceCandidate(new RTCIceCandidate(iceCandidates[index]))
            }
          }
        }
        
        // Finalize wsConnection required
        if ('sendResponse'.localeCompare(msgCommand) === 0) {
          wsConnection.close()

          // All done
          resolve()
        }
      }

      wsConnection.onclose = () => console.log('[Player] wsConnection.onclose')
      
      wsConnection.onerror = (evt) => {
        console.log('[Player] wsConnection.onerror: ' + JSON.stringify(evt))
        reject(new Error(JSON.stringify(evt)))
      }

      defineCanceller(() => {
        console.log('[Player] Cancel connecting promise.')
        wsConnection.close()
      })
    }))

    return this.connecting
      .then((o) => {
        this.connecting = undefined
        return o
      })
      .catch((error) => {
        this.connecting = undefined
        this._reportError(error)
      })
  }

  stop() {
    // stop stream if necessary
    if (this.hostElement.srcObject) {
      this.hostElement.srcObject = null
    }
    if (this.hostElement.src) {
      this.hostElement.src = ''
    }
  
    // release resources
    this.peerConnection && this.peerConnection.close()
    this.peerConnection = undefined

    this.connecting && this.connecting.cancel()

    this._reportStatus()
    console.log('[Player] Disconnected')
  }

  private _reportError(error: Error) {
    this.lastError = error
    this.stop()
  }

  private _reportStatus() {
    this.onStateChanged({ 
      isMuted: this.isMuted, 
      isPlaying: this.isPlaying, 
      error: this.lastError
    })
  }
}